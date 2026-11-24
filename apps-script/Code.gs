/**
 * 로데오공인중개사무소 홈페이지 상담 접수 (Google Apps Script)
 *
 * 이 스크립트는 "로데오 홈페이지 상담 접수" 구글 시트에 붙여서 씁니다.
 * 설치 방법은 apps-script/설치방법.md 를 보세요.
 *
 * 하는 일
 *  1. 홈페이지 문의 폼에서 보낸 내용을 검사해 시트에 한 줄로 저장
 *  2. 알림 메일 발송 (NOTIFY_EMAILS)
 *  3. '처리 상태'를 '완료'로 바꾸면 완료일 기록
 *  4. 매일 새벽, 완료일로부터 1년이 지난 줄을 삭제 (보유 기간: 상담 완료 후 1년)
 */

// ===== 설정 =====
const NOTIFY_EMAILS = 'realtor90096837@gmail.com'; // 알림 받을 메일 (여러 개는 쉼표로 구분)
const SHEET_ID = '1HlojkcIJTwd_25743Jpzs87izLVMDBpQP_Q2XKN_3Xg'; // 로데오 홈페이지 상담 접수 시트
const SHEET_NAME = '접수';
function book() { return SpreadsheetApp.openById(SHEET_ID); }
const RETENTION_DAYS = 365;          // 상담 완료 후 보유 기간
const CONSENT_VERSION = '2026-11-24'; // 동의 문구 버전 (문구를 바꾸면 홈페이지와 함께 수정)
const HEADERS = ['접수번호', '접수일시', '기업명', '담당자', '연락처', '문의 분야', '상담 내용',
                 '개인정보 동의', '동의 문구 버전', '접수 페이지', '처리 상태', '완료일', '메모'];
const COL = Object.fromEntries(HEADERS.map((h, i) => [h, i + 1]));
const Q_SHEET = '질문';
const Q_HEADERS = ['접수번호', '접수일시', '질문 분야', '제목', '질문', '이름·닉네임', '연락처', '공개 상태', '개인정보 동의', '동의 문구 버전', '답변', '답변자', '답변일', '조회수', '처리 상태', '완료일', '메모'];
const QC = Object.fromEntries(Q_HEADERS.map((h, i) => [h, i + 1]));
const LIMITS = { company: 80, name: 40, phone: 20, field: 30, message: 2000, page: 200 };

// ===== 처음 한 번 실행: 시트 머리글, 자동 삭제 예약 =====
function setup() {
  const ss = book();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(['접수', '연락 완료', '완료'], true).build();
    sh.getRange(2, COL['처리 상태'], sh.getMaxRows() - 1, 1).setDataValidation(rule);
  }
  let qs = ss.getSheetByName(Q_SHEET);
  if (!qs) qs = ss.insertSheet(Q_SHEET);
  qs.getRange(1, 1, 1, Q_HEADERS.length).setValues([Q_HEADERS]).setFontWeight('bold');
  qs.setFrozenRows(1);
  qs.getRange(2, 1, qs.getMaxRows() - 1, qs.getMaxColumns()).clearDataValidations();
  qs.getRange(2, QC['공개 상태'], qs.getMaxRows() - 1, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['공개', '비밀', '숨김'], true).build());
  qs.getRange(2, QC['처리 상태'], qs.getMaxRows() - 1, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['접수', '답변 완료', '완료'], true).build());
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('purgeExpired').timeBased().everyDays(1).atHour(3).create();
  ScriptApp.newTrigger('onEditStamp').forSpreadsheet(ss).onEdit().create();
}

// ===== 홈페이지에서 보내는 접수 =====
function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // 자동 입력 방지: 사람에게는 보이지 않는 칸이 채워져 있으면 저장하지 않음
    if (d.website) return out({ ok: true });
    if (d.type === 'question') return saveQuestion(d);
    if (d.type === 'view') return addView(clean(d.id, 20));

    const v = {
      company: clean(d.company, LIMITS.company),
      name: clean(d.name, LIMITS.name),
      phone: clean(d.phone, LIMITS.phone),
      field: clean(d.field, LIMITS.field),
      message: clean(d.message, LIMITS.message),
      page: clean(d.page, LIMITS.page),
    };
    const errors = [];
    if (!v.company) errors.push('company');
    if (!v.name) errors.push('name');
    if (!/^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(v.phone)) errors.push('phone');
    if (!v.message) errors.push('message');
    if (d.consent !== true) errors.push('consent');
    if (errors.length) return out({ ok: false, error: 'invalid', fields: errors });

    // 같은 번호로 1분 안에 다시 보내면 막음
    const cache = CacheService.getScriptCache();
    const key = 'p_' + v.phone.replace(/\D/g, '');
    if (cache.get(key)) return out({ ok: false, error: 'too_soon' });
    cache.put(key, '1', 60);

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    let id;
    try {
      const sh = book().getSheetByName(SHEET_NAME);
      const now = new Date();
      id = Utilities.formatDate(now, 'Asia/Seoul', 'yyMMdd') + '-' + Utilities.getUuid().slice(0, 4).toUpperCase();
      sh.appendRow([id, now, safe(v.company), safe(v.name), safe(v.phone), safe(v.field), safe(v.message),
                    '동의', CONSENT_VERSION, safe(v.page), '접수', '', '']);
    } finally {
      lock.releaseLock();
    }

    try {
      MailApp.sendEmail({
        to: NOTIFY_EMAILS,
        subject: `[홈페이지 상담 접수] ${v.company} · ${v.name}`,
        body: [`접수번호: ${id}`, `기업명: ${v.company}`, `담당자: ${v.name}`, `연락처: ${v.phone}`,
               `문의 분야: ${v.field || '-'}`, '', v.message, '',
               '접수 시트에서 처리 상태를 바꿔 주세요. 이 메일은 보관하지 말고 처리 후 삭제해 주세요.'].join('\n'),
      });
    } catch (mailErr) {
      // 메일이 실패해도 접수는 시트에 저장되어 있음
      console.error(mailErr);
    }
    return out({ ok: true, id });
  } catch (err) {
    console.error(err);
    return out({ ok: false, error: 'server' });
  }
}

// ===== Q&A 게시판 ('질문' 탭) =====
function saveQuestion(d) {
  const v = { field: clean(d.field, 30), title: clean(d.title, 80), question: clean(d.question, 1500), nickname: clean(d.nickname, 20), phone: clean(d.phone, 20) };
  if (!v.title || !v.question) return out({ ok: false, error: 'invalid', fields: ['title', 'question'].filter(k => !v[k]) });
  if (v.phone && !/^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(v.phone)) return out({ ok: false, error: 'invalid', fields: ['phone'] });
  if ((v.phone || v.nickname) && d.consent !== true) return out({ ok: false, error: 'invalid', fields: ['consent'] });
  const cache = CacheService.getScriptCache();
  const key = 'q_' + (v.phone.replace(/\D/g, '') || Utilities.base64EncodeWebSafe(v.title.slice(0, 30)));
  if (cache.get(key)) return out({ ok: false, error: 'too_soon' });
  cache.put(key, '1', 60);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  let id;
  try {
    const sh = book().getSheetByName(Q_SHEET);
    const now = new Date();
    id = 'Q' + Utilities.formatDate(now, 'Asia/Seoul', 'yyMMdd') + '-' + Utilities.getUuid().slice(0, 4).toUpperCase();
    const row = Q_HEADERS.map(h => '');
    row[QC['접수번호'] - 1] = id; row[QC['접수일시'] - 1] = now; row[QC['질문 분야'] - 1] = safe(v.field);
    row[QC['제목'] - 1] = safe(v.title); row[QC['질문'] - 1] = safe(v.question); row[QC['이름·닉네임'] - 1] = safe(v.nickname);
    row[QC['연락처'] - 1] = safe(v.phone); row[QC['공개 상태'] - 1] = d.secret === true ? '비밀' : '공개';
    row[QC['개인정보 동의'] - 1] = (v.phone || v.nickname) ? '동의' : '해당 없음'; row[QC['동의 문구 버전'] - 1] = CONSENT_VERSION;
    row[QC['조회수'] - 1] = 0; row[QC['처리 상태'] - 1] = '접수';
    sh.appendRow(row);
  } finally { lock.releaseLock(); }
  try {
    MailApp.sendEmail({ to: NOTIFY_EMAILS, subject: `[홈페이지 Q&A] ${v.title}`,
      body: [`접수번호: ${id}`, `분야: ${v.field || '-'}`, `공개 상태: ${d.secret === true ? '비밀글' : '공개글'}`, `이름·닉네임: ${v.nickname || '-'}`, `연락처: ${v.phone || '-'}`, '', v.title, v.question, '',
             '답변은 접수 시트 [질문] 탭의 \'답변\' 칸에 적으면 게시판에 바로 표시됩니다. 부적절한 글은 \'공개 상태\'를 숨김으로 바꾸세요.'].join('\n') });
  } catch (mailErr) { console.error(mailErr); }
  return out({ ok: true, id });
}

// 게시판에 보이는 글: 숨김이 아닌 것. 연락처는 절대 내보내지 않음
function boardRows() {
  const sh = book().getSheetByName(Q_SHEET);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, Q_HEADERS.length).getValues()
    .map((r, i) => ({ r, row: i + 2 }))
    .filter(x => x.r[0] && x.r[QC['공개 상태'] - 1] !== '숨김');
}
function maskName(n) { n = String(n || '').trim(); return n ? n.slice(0, 1) + '*'.repeat(Math.min(Math.max(n.length - 1, 1), 3)) : '익명'; }
function maskText(t) { return String(t || '').replace(/0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g, '***-****-****').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '***@***'); }
function fmt(d) { return d instanceof Date ? Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd') : String(d || ''); }
function boardList() {
  return boardRows().map(({ r }) => {
    const secret = r[QC['공개 상태'] - 1] === '비밀';
    return { id: r[0], date: fmt(r[QC['접수일시'] - 1]), field: r[QC['질문 분야'] - 1],
      title: secret ? '비밀글입니다' : maskText(r[QC['제목'] - 1]), secret,
      author: maskName(r[QC['이름·닉네임'] - 1]), views: Number(r[QC['조회수'] - 1]) || 0, answered: !!String(r[QC['답변'] - 1]).trim() };
  }).reverse();
}
function boardPost(id) {
  const x = boardRows().find(({ r }) => r[0] === id);
  if (!x) return { ok: false, error: 'not_found' };
  const r = x.r;
  if (r[QC['공개 상태'] - 1] === '비밀') return { ok: true, secret: true, answered: !!String(r[QC['답변'] - 1]).trim() };
  return { ok: true, secret: false, id, title: maskText(r[QC['제목'] - 1]), question: maskText(r[QC['질문'] - 1]), field: r[QC['질문 분야'] - 1],
    author: maskName(r[QC['이름·닉네임'] - 1]), date: fmt(r[QC['접수일시'] - 1]), views: Number(r[QC['조회수'] - 1]) || 0,
    answer: String(r[QC['답변'] - 1] || ''), answered_by: String(r[QC['답변자'] - 1] || ''), answer_date: fmt(r[QC['답변일'] - 1]) };
}
function addView(id) {
  const lock = LockService.getScriptLock(); lock.waitLock(5000);
  try {
    const x = boardRows().find(({ r }) => r[0] === id);
    if (!x) return out({ ok: false });
    const c = book().getSheetByName(Q_SHEET).getRange(x.row, QC['조회수']);
    c.setValue((Number(c.getValue()) || 0) + 1);
    return out({ ok: true });
  } finally { lock.releaseLock(); }
}

// 접수 주소를 브라우저로 열었을 때 확인용
function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === 'list') return out({ ok: true, items: boardList() });
    if (p.action === 'post') return out(boardPost(clean(p.id, 20)));
  } catch (err) { console.error(err); return out({ ok: false, error: 'server' }); }
  return out({ ok: true, service: 'rodeo-inquiry' });
}

// ===== '처리 상태'가 '완료'가 되면 완료일 기록 =====
function onEditStamp(e) {
  const r = e.range, sh = r.getSheet();
  const isQ = sh.getName() === Q_SHEET;
  if (isQ && r.getColumn() === QC['답변'] && r.getRow() >= 2) {
    if (String(r.getValue()).trim()) {
      if (!sh.getRange(r.getRow(), QC['답변일']).getValue()) sh.getRange(r.getRow(), QC['답변일']).setValue(new Date());
      if (!sh.getRange(r.getRow(), QC['답변자']).getValue()) sh.getRange(r.getRow(), QC['답변자']).setValue('김태욱 공인중개사');
      if (sh.getRange(r.getRow(), QC['처리 상태']).getValue() === '접수') sh.getRange(r.getRow(), QC['처리 상태']).setValue('답변 완료');
    }
    return;
  }
  const stCol = isQ ? QC['처리 상태'] : COL['처리 상태'], doneCol = isQ ? QC['완료일'] : COL['완료일'];
  if ((sh.getName() !== SHEET_NAME && !isQ) || r.getColumn() !== stCol || r.getRow() < 2) return;
  const done = sh.getRange(r.getRow(), doneCol);
  if (r.getValue() === '완료' && !done.getValue()) done.setValue(new Date());
  if (r.getValue() !== '완료') done.clearContent();
}

// ===== 보유 기간이 지난 줄 삭제 =====
function purgeExpired() {
  purgeSheet(SHEET_NAME, COL['완료일']);
  purgeSheet(Q_SHEET, QC['완료일']);
}
function purgeSheet(name, doneCol) {
  const sh = book().getSheetByName(name);
  if (!sh) return;
  const last = sh.getLastRow();
  if (last < 2) return;
  const doneDates = sh.getRange(2, doneCol, last - 1, 1).getValues();
  const limit = Date.now() - RETENTION_DAYS * 864e5;
  for (let i = doneDates.length - 1; i >= 0; i--) {
    const d = doneDates[i][0];
    if (d instanceof Date && d.getTime() < limit) sh.deleteRow(i + 2);
  }
}

// ===== 도우미 =====
function clean(s, max) { return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max); }
// 시트에서 수식으로 실행되지 않게 (=, +, -, @ 로 시작하면 앞에 ' 를 붙임)
function safe(s) { return /^[=+\-@]/.test(s) ? "'" + s : s; }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
