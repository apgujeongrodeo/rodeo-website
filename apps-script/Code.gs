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
const SHEET_NAME = '접수';
const RETENTION_DAYS = 365;          // 상담 완료 후 보유 기간
const CONSENT_VERSION = '2026-11-24'; // 동의 문구 버전 (문구를 바꾸면 홈페이지와 함께 수정)
const HEADERS = ['접수번호', '접수일시', '기업명', '담당자', '연락처', '문의 분야', '상담 내용',
                 '개인정보 동의', '동의 문구 버전', '접수 페이지', '처리 상태', '완료일', '메모'];
const COL = Object.fromEntries(HEADERS.map((h, i) => [h, i + 1]));
const LIMITS = { company: 80, name: 40, phone: 20, field: 30, message: 2000, page: 200 };

// ===== 처음 한 번 실행: 시트 머리글, 자동 삭제 예약 =====
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(['접수', '연락 완료', '완료'], true).build();
    sh.getRange(2, COL['처리 상태'], sh.getMaxRows() - 1, 1).setDataValidation(rule);
  }
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
      const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
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

// 접수 주소를 브라우저로 열었을 때 확인용
function doGet() { return out({ ok: true, service: 'rodeo-inquiry' }); }

// ===== '처리 상태'가 '완료'가 되면 완료일 기록 =====
function onEditStamp(e) {
  const r = e.range, sh = r.getSheet();
  if (sh.getName() !== SHEET_NAME || r.getColumn() !== COL['처리 상태'] || r.getRow() < 2) return;
  const done = sh.getRange(r.getRow(), COL['완료일']);
  if (r.getValue() === '완료' && !done.getValue()) done.setValue(new Date());
  if (r.getValue() !== '완료') done.clearContent();
}

// ===== 보유 기간이 지난 줄 삭제 =====
function purgeExpired() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const last = sh.getLastRow();
  if (last < 2) return;
  const doneDates = sh.getRange(2, COL['완료일'], last - 1, 1).getValues();
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
