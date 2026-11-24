/* 로데오공인중개사무소 · 공용 스크립트
   모든 글과 사진은 /content/*.json 에서 읽습니다 (Pages CMS 로 편집). */
{
const PAGE = document.body.dataset.page;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const br = v => esc(v).replace(/\n/g, '<br>');
const paras = v => String(v ?? '').split(/\n\s*\n/).filter(Boolean).map(p => `<p>${br(p)}</p>`).join('');
const src = v => { const s = String(v || ''); return s.startsWith('/') ? s.slice(1) : s; }; // 상대 경로로 (미리보기·배포 모두 동작)
const img = (path, alt, cls = 'img', label = '사진 자리') => path
  ? `<img class="${cls}" src="${esc(src(path))}" alt="${esc(alt || '')}" loading="lazy">`
  : `<div class="ph ${cls}" role="img" aria-label="${esc(label)}"><span>${esc(label)}</span></div>`;
// 운영자가 쓴 본문(HTML)에서 스크립트·이벤트 속성 등을 걷어 냅니다
const clean = html => {
  const t = document.createElement('template'); t.innerHTML = String(html || '');
  t.content.querySelectorAll('script,style,iframe,object,embed,form,link,meta').forEach(n => n.remove());
  t.content.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => {
    if (/^on/i.test(a.name) || (/^(href|src)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) n.removeAttribute(a.name);
  }));
  return t.innerHTML;
};
const load = name => fetch(`content/${name}.json`, {cache: 'no-cache'}).then(r => { if (!r.ok) throw new Error(name); return r.json(); });
const fail = msg => { const m = $('main'); if (m) m.insertAdjacentHTML('afterbegin', `<p class="loadfail" role="alert">${esc(msg)}</p>`); };
const FIELD_ETC = {key: 'etc', name: '기타'};
const TYPE = {shop: '상가', office: '사무실', clinic: '병의원'};

/* ---------- 공통: 헤더·메뉴·사이트 정보 ---------- */
const hdr = $('header.site');
addEventListener('scroll', () => hdr && hdr.classList.toggle('scrolled', scrollY > 8), {passive: true});
const mb = $('#menuBtn'), dr = $('#drawer');
const setMenu = o => { if (!dr) return; dr.classList.toggle('open', o); mb.setAttribute('aria-expanded', o); mb.textContent = o ? '닫기' : '메뉴'; document.body.style.overflow = o ? 'hidden' : ''; };
mb && mb.addEventListener('click', () => setMenu(!dr.classList.contains('open')));
dr && dr.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

let SITE = {};
const site = load('site').then(s => {
  SITE = s;
  $$('[data-site]').forEach(el => { const v = s[el.dataset.site]; if (v) el.textContent = v; });
  $$('[data-tel]').forEach(a => a.href = 'tel:' + String(s.phone || '').replace(/\D/g, ''));
  const kakao = /^https:\/\/open\.kakao\.com\//.test(String(s.kakao_url || '')) ? s.kakao_url : '';
  if (kakao) $$('[data-kakao]').forEach(a => a.href = kakao); // 비어 있으면 기본 주소 그대로 (버튼은 숨기지 않음)
  const legal = [s.address, s.registration_no && `중개사무소 등록번호 ${s.registration_no}`, s.business_no && `사업자등록번호 ${s.business_no}`].filter(Boolean);
  const lg = $('#legal'); if (lg) lg.innerHTML = legal.map(esc).join('<br>');
  return s;
}).catch(() => ({}));

/* leaf shadows (메인·신념 영역) */
const blobs = [[6,42,18,22],[26,38,14,26],[40,50,20,18],[58,40,16,24],[76,46,20,20],[90,38,12,26],[14,70,22,14],[48,72,26,12],[72,70,20,14]];
$$('.leaves').forEach(el => el.innerHTML = blobs.map(([x,y,w,h]) => `<i style="left:${x}%;top:${y}%;width:${w}%;height:${h}%"></i>`).join(''));

/* ---------- 페이지별 ---------- */
const R = {};

R.home = async () => {
  const [h, sv, pj] = await Promise.all([load('home'), load('services').catch(() => ({items: []})), load('projects').catch(() => ({items: []}))]);
  $('#hEyebrow').textContent = h.hero_eyebrow || '';
  $('#hTitle').innerHTML = (h.hero_title || []).map(l => `<span class="l"><span>${esc(l)}</span></span>`).join('');
  $('#hLead').textContent = h.hero_lead || '';
  const mq = esc(h.marquee || '').replace(/ — /g, '<em>—</em>');
  $('#marq').innerHTML = `<p>${mq}<em>—</em></p><p>${mq}<em>—</em></p>`;
  $('#hostTitle').innerHTML = br(h.host_title);
  $('#hostText').textContent = h.host_text || '';
  $('#facts').innerHTML = (h.facts || []).map(f => `<div><b>${esc(f.value)}</b><span>${esc(f.label)}</span></div>`).join('');
  $('#mosaic').innerHTML = img(h.host_image, h.host_image_alt, 'img m1') + img(h.office_image, h.office_image_alt, 'img m2');
  $('#belief').textContent = h.belief || '';
  $('#homeSvc').innerHTML = (sv.items || []).map((s, i) => `<li><a href="services.html#${esc(s.key)}"><span class="no">N°${i+1}</span><h3>${esc(s.name)}</h3><p>${esc(s.who)}</p><span class="ar" aria-hidden="true">→</span></a></li>`).join('');
  const cases = (pj.items || []).filter(p => p.published);
  $('#homeCases').innerHTML = cases.length ? cases.slice(0, 3).map(caseCard).join('') : '';
  $('#homeCasesSec').hidden = !cases.length;
};

const caseCard = (c, i) => `<a class="ccard" href="projects.html#${esc(c.slug)}">${img(c.cover || c.poster, c.title, 'img r43', '매물 사진 자리')}<div class="bd"><span class="no">사례 N°${i+1} · ${esc(TYPE[c.type] || '')}</span><h3>${esc(c.title)}</h3><p>${esc(c.summary)}</p></div></a>`;

R.about = async () => {
  const a = await load('about');
  $('#pTitle').innerHTML = br(a.title); $('#pLead').textContent = a.lead || '';
  $('#histImg').innerHTML = img(a.history_image, a.history_image_alt, 'img tall');
  $('#histTitle').textContent = a.history_title || ''; $('#histText').innerHTML = paras(a.history_text);
  $('#methods').innerHTML = (a.methods || []).map((m, i) => `<article><span class="no">N°${i+1}</span><h3>${esc(m.title)}</h3><p>${esc(m.text)}</p></article>`).join('');
  $('#profTitle').textContent = a.profile_title || ''; $('#profText').innerHTML = paras(a.profile_text);
  $('#profImg').innerHTML = img(a.profile_image, a.profile_image_alt, 'img tall');
  record();
};

/* ---------- 회사소개 · 로데오의 기록 ---------- */
const DEAL = {lease: '임대', sale: '매매', sublease: '전대', etc: '기타'};
const PROP = {shop: '상가', office: '사무실', clinic: '병의원', building: '건물', etc: '기타'};
// 디자인 확인용 예시 (주소 끝이 #record-demo 일 때만 표시, 실제 거래 아님)
const DEMO = [
  ['2026-10', 'lease', 'shop', '뷰티 브랜드', '압구정로데오 메인 거리', 'name', '예시 뷰티 A', '1층 플래그십 매장'],
  ['2026-10', 'lease', 'office', '패션 브랜드 본사', '신사동 도산대로 이면', 'industry'],
  ['2026-07', 'sale', 'building', '근린생활시설', '압구정로데오 이면 골목', 'industry'],
  ['2026-04', 'lease', 'clinic', '피부과 의원', '신사동', 'industry', '', '2층 개원'],
  ['2026-02', 'lease', 'shop', '카페', '압구정로데오 이면 골목', 'name', '예시 카페 B'],
  ['2025-11', 'lease', 'shop', '패션 편집숍', '압구정로데오 메인 거리', 'industry'],
  ['2025-08', 'sublease', 'shop', '팝업 스토어', '압구정로데오', 'industry', '', '3개월 단기'],
  ['2025-03', 'lease', 'office', '디자인 스튜디오', '신사동', 'industry'],
  ['2024-12', 'sale', 'shop', '상가', '압구정로데오 이면 골목', 'industry'],
  ['2024-06', 'lease', 'shop', '뷰티 브랜드', '압구정로데오 메인 거리', 'industry'],
].map(([d, deal_type, property, industry, area, disclosure, brand_name = '', note = '']) => ({date: d + '-01', deal_type, property, industry, area, disclosure, brand_name, consent: true, note, published: true}));

async function record() {
  const sec = $('#record'); if (!sec) return;
  const h = await load('history').catch(() => ({items: []}));
  const demo = location.hash === '#record-demo';
  $('#recIntro').textContent = h.intro || '';
  $('#recDemo').hidden = !demo;
  if (h.founded) { $('#foundYear').textContent = h.founded.year || ''; $('#foundText').textContent = h.founded.text || ''; }
  // 공개 규칙: 공개 체크 + '표시 안 함' 아님. 상호명은 '상호명 공개' + 동의 확인일 때만. 금액 칸은 아예 없음.
  const items = (demo ? DEMO : (h.items || [])).filter(x => x.published && x.disclosure !== 'hidden' && /^\d{4}-\d{2}/.test(String(x.date || '')));
  const title = x => { if (x.disclosure === 'name' && x.consent && x.brand_name) return x.brand_name; const base = x.industry || PROP[x.property] || ''; const suf = {shop: '매장', office: '사무실'}[x.property] || ''; return suf && !base.endsWith(suf) && base !== PROP[x.property] ? `${base} ${suf}` : base; };
  let deal = 'all', year = null;
  const years = () => [...new Set(items.filter(x => deal === 'all' || x.deal_type === deal).map(x => String(x.date).slice(0, 4)))].sort().reverse();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const draw = () => {
    const ys = years();
    $('#recEmpty').hidden = ys.length > 0; $('#years').hidden = !ys.length; $('#ledger').hidden = !ys.length; $('#ysum').hidden = !ys.length;
    if (!ys.length) return;
    if (!ys.includes(year)) year = ys[0];
    $('#years').innerHTML = ys.map(y => {
      const n = items.filter(x => String(x.date).startsWith(y) && (deal === 'all' || x.deal_type === deal)).length;
      return `<button class="yr" role="tab" type="button" data-y="${y}" aria-selected="${y === year}" tabindex="${y === year ? 0 : -1}">${y}<small>${n}건</small></button>`;
    }).join('');
    const list = items.filter(x => String(x.date).startsWith(year) && (deal === 'all' || x.deal_type === deal)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const by = {}; list.forEach(x => { const m = String(x.date).slice(5, 7); (by[m] = by[m] || []).push(x); });
    const cnt = k => list.filter(x => x.deal_type === k).length;
    $('#ysum').textContent = `${year}년 · ${list.length}건` + ['lease', 'sale', 'sublease'].filter(cnt).map(k => ` · ${DEAL[k]} ${cnt(k)}`).join('');
    $('#ledger').innerHTML = Object.keys(by).sort().reverse().map((m, i) => `<li class="mrow" style="animation-delay:${reduce ? 0 : i * 90}ms"><div class="mo">${+m}<small>월</small></div><div class="deals">${
      by[m].map(x => `<article class="deal"><div class="tags"><span class="tag2 ${esc(x.deal_type)}">${esc(DEAL[x.deal_type] || '')}</span><span class="tag2">${esc(PROP[x.property] || '')}</span>${x.industry && title(x) !== x.industry ? `<span class="tag2">${esc(x.industry)}</span>` : ''}</div><h3>${esc(title(x))}</h3>${x.area ? `<p class="where">${esc(x.area)}</p>` : ''}${x.note ? `<p class="nt">${esc(x.note)}</p>` : ''}</article>`).join('')
    }</div></li>`).join('');
  };
  const pick = y => { if (y && y !== year) { year = y; draw(); const b = $(`#years [data-y="${y}"]`); b && b.focus({preventScroll: true}); } };
  // 마우스를 올리면 그 해로 바뀌며 월별 기록이 차례로 펼쳐짐 (터치·키보드는 누르면)
  let hoverT;
  $('#years').addEventListener('mouseover', e => { const b = e.target.closest('.yr'); if (!b || !matchMedia('(hover:hover)').matches) return; clearTimeout(hoverT); hoverT = setTimeout(() => { if (b.dataset.y !== year) { year = b.dataset.y; draw(); } }, 140); });
  $('#years').addEventListener('click', e => { const b = e.target.closest('.yr'); if (b) pick(b.dataset.y); });
  $('#years').addEventListener('keydown', e => {
    const ys = years(), i = ys.indexOf(year);
    if (e.key === 'ArrowRight' && i < ys.length - 1) { e.preventDefault(); pick(ys[i + 1]); }
    if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); pick(ys[i - 1]); }
  });
  $$('.rec-filter button').forEach(b => b.addEventListener('click', () => { deal = b.dataset.deal; $$('.rec-filter button').forEach(x => x.setAttribute('aria-pressed', x === b)); draw(); }));
  draw();
  if (demo) requestAnimationFrame(() => sec.scrollIntoView({block: 'start'}));
}

R.services = async () => {
  const s = await load('services');
  $('#pTitle').innerHTML = br(s.title); $('#pLead').textContent = s.lead || '';
  const items = s.items || [];
  $('#jump').innerHTML = items.map(x => `<a href="#${esc(x.key)}">${esc(x.name)}</a>`).join('');
  $('#svcList').innerHTML = items.map((x, i) => `<article class="svcd" id="${esc(x.key)}">
    <div class="svcd-h"><span class="no">N°${i+1}</span><h2>${esc(x.name)}</h2></div>
    ${x.image ? `<div class="svcimg">${img(x.image, x.name, 'img')}</div>` : ''}
    <dl><div><dt>누가 이용하나요</dt><dd>${esc(x.who)}</dd></div>
    <div><dt>어떤 조건을 확인하나요</dt><dd><ul>${(x.checks || []).map(c => `<li>${esc(c)}</li>`).join('')}</ul></dd></div>
    <div><dt>상담할 때 알려주세요</dt><dd>${esc(x.tell)}</dd></div></dl>
    <a class="btn cta" href="contact.html#${esc(x.key)}">${esc(x.name)} 문의하기</a></article>`).join('');
  scrollToHash();
};

R.consulting = async () => {
  const c = await load('consulting');
  $('#pTitle').innerHTML = br(c.title); $('#pLead').textContent = c.lead || '';
  $('#flow').innerHTML = (c.steps || []).map((s, i) => `<li><span class="no">${i+1}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join('');
  $('#cmp').innerHTML = (c.compare || []).map(r => `<tr><td>${esc(r.item)}</td><td>${esc(r.how)}</td><td class="blank">상담 후 기재</td><td class="blank">상담 후 기재</td></tr>`).join('');
  $('#afterTitle').textContent = c.aftercare_title || ''; $('#afterText').textContent = c.aftercare_text || '';
  $('#afterList').innerHTML = (c.aftercare_points || []).map(p => `<li>${esc(p)}</li>`).join('');
  $('#renewTitle').textContent = c.renewal_title || ''; $('#renewText').innerHTML = paras(c.renewal_text);
};

R.projects = async () => {
  const p = await load('projects');
  const items = (p.items || []).filter(x => x.published);
  const renderList = f => {
    const list = items.filter(x => f === 'all' || x.type === f);
    $('#cases').innerHTML = list.map(caseCard).join('');
    $('#casesEmpty').hidden = list.length > 0;
  };
  renderList('all');
  $$('.filters button').forEach(b => b.addEventListener('click', () => { $$('.filters button').forEach(x => x.setAttribute('aria-selected', x === b)); renderList(b.dataset.f); }));
  $('#caseDetail').innerHTML = items.map((c, i) => `<section class="sec tint casesec" id="${esc(c.slug)}"><div class="wrap">
    <p class="eyebrow">사례 N°${i+1} · ${esc(TYPE[c.type] || '')}</p><h2>${esc(c.title)}</h2>
    <div class="split case"><div>
      <button class="poster" type="button" data-poster="${esc(src(c.poster))}" data-title="${esc(c.title)}" ${c.poster ? '' : 'disabled'} aria-label="매물 포스터 크게 보기">${img(c.poster, c.title + ' 매물 포스터', 'img r34', '매물 포스터 자리')}${c.poster ? '<span class="zoom">포스터 크게 보기</span>' : ''}</button>
      <div class="thumbs">${(c.gallery || []).map(g => img(g, c.title, 'img r43')).join('') || img('', '', 'img r43', '매물 사진 자리') + img('', '', 'img r43', '매물 사진 자리')}</div>
    </div><div class="prose">
      <h3>당시 검토 조건</h3>
      <dl class="spec">${(c.conditions || []).map(d => `<div><dt>${esc(d.label)}</dt><dd${d.value ? '' : ' class="pending"'}>${d.value ? esc(d.value) : '홍보 자료 기준 조건 기재 예정'}</dd></div>`).join('')}</dl>
      <p class="note">${esc(c.basis_note)}</p>
      <h3>현장에서 살펴볼 포인트</h3>
      <ul class="checks">${(c.checkpoints || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <a class="btn cta" href="contact.html#${c.type === 'clinic' ? 'clinic' : c.type === 'office' ? 'office' : 'lease'}">이 사례로 문의하기</a>
    </div></div></div></section>`).join('');
  // poster lightbox
  const lb = $('#lightbox'); let last = null;
  const close = () => { lb.hidden = true; last && last.focus(); };
  $$('[data-poster]').forEach(b => b.addEventListener('click', () => {
    if (!b.dataset.poster) return; last = b;
    $('#lbImg').innerHTML = `<img src="${esc(b.dataset.poster)}" alt="${esc(b.dataset.title)} 매물 포스터">`;
    lb.hidden = false; $('#lbClose').focus();
  }));
  $('#lbClose').addEventListener('click', close);
  lb.addEventListener('click', e => { if (e.target === lb) close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !lb.hidden) close(); });
  scrollToHash();
};

R.insights = async () => {
  const d = await load('insights');
  const items = (d.items || []).filter(x => x.published).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  $('#acards').innerHTML = items.map(a => `<article class="acard">${a.cover ? img(a.cover, a.title, 'img r169') : ''}<span class="no">${esc(a.category)}</span><h3>${esc(a.title)}</h3><p>${esc(a.summary)}</p><a class="more" href="#${esc(a.slug)}">본문 읽기</a></article>`).join('') || '<p class="empty">아직 공개한 글이 없습니다.</p>';
  const show = () => {
    const key = decodeURIComponent(location.hash.slice(1));
    const a = items.find(x => x.slug === key);
    $('#listView').hidden = !!a; $('#phead').hidden = !!a; $('#article').hidden = !a;
    if (a) {
      const srcs = (a.sources || []).filter(s => s.name);
      $('#article').innerHTML = `<p class="crumb"><a href="insights.html">상권 인사이트</a> / ${esc(a.category)}</p>
        <h1 class="atitle" tabindex="-1">${esc(a.title)}</h1><p class="lead">${esc(a.summary)}</p>
        ${a.cover ? img(a.cover, a.title, 'img r169') : ''}
        <div class="prose abody">${clean(a.body)}</div>
        ${srcs.length ? `<div class="sources"><h3>출처</h3><ul>${srcs.map(s => `<li>${s.url ? `<a href="${esc(s.url)}" rel="noopener">${esc(s.name)}</a>` : esc(s.name)}${s.as_of ? ` · 기준 ${esc(s.as_of)}` : ''}</li>`).join('')}</ul></div>` : ''}
        <p class="note">이 글은 일반적인 확인 사항을 정리한 것입니다. 구체적인 판단은 상담과 관련 전문가 확인이 필요합니다.</p>
        <div class="acts"><a class="btn" href="insights.html">목록으로</a><a class="btn cta" href="contact.html#consult">이 내용으로 상담하기</a></div>`;
      document.title = `${a.title} · 로데오공인중개사무소`;
      scrollTo(0, 0); $('#article h1').focus({preventScroll: true});
    } else document.title = '상권 인사이트 · 로데오공인중개사무소';
  };
  addEventListener('hashchange', show); show();
};

R.contact = async () => {
  const sv = await load('services').catch(() => ({items: []}));
  const fields = [...(sv.items || []), FIELD_ETC];
  const sel = $('#field');
  sel.innerHTML = '<option value="">선택 안 함</option>' + fields.map(f => `<option value="${esc(f.key)}">${esc(f.name)}</option>`).join('');
  const pre = () => { const k = decodeURIComponent(location.hash.slice(1)); if (fields.some(f => f.key === k)) sel.value = k; };
  pre(); addEventListener('hashchange', pre);
  const s = await site;
  const endpoint = String(s.form_endpoint || '').trim();
  const online = /^https:\/\//.test(endpoint);
  if (!online) $('#formMode').textContent = '온라인 접수를 연결하는 중입니다. 지금은 입력하신 내용으로 문자 문안을 만들어 드립니다.';
  const smsNo = String(s.sms_number || '').replace(/\D/g, '');
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || matchMedia('(pointer:coarse)').matches;
  const status = (t, kind) => { const el = $('#status'); el.hidden = !t; el.textContent = t || ''; el.className = 'status' + (kind ? ' ' + kind : ''); };
  const btn = $('#submitBtn');
  const val = id => $(id).value.trim();
  const fieldName = () => (fields.find(f => f.key === sel.value) || {}).name || '';

  const showDraft = lead => {
    const lines = [`[${s.name || '로데오공인중개사무소'} 상담 신청]`, `기업명: ${val('#company')}`, `담당자: ${val('#cname')}`, `연락처: ${val('#phone')}`];
    if (fieldName()) lines.push(`문의 분야: ${fieldName()}`);
    lines.push(`상담 내용: ${val('#cmsg')}`);
    $('#draftText').value = lines.join('\n');
    $('#smsBtn').href = `sms:${smsNo}?&body=${encodeURIComponent(lines.join('\n'))}`;
    $('#smsBtn').hidden = !isMobile || !smsNo;
    $('#draftLead').textContent = lead;
    $('#draft').hidden = false;
  };

  const check = () => {
    const ok = {
      fCompany: !!val('#company'), fName: !!val('#cname'),
      fPhone: /^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(val('#phone').replace(/\s/g, '')),
      fMsg: !!val('#cmsg'), fAgree: $('#agree').checked,
    };
    let first = null;
    for (const k in ok) { const f = document.getElementById(k); f.classList.toggle('bad', !ok[k]); if (!ok[k] && !first) first = f; }
    if (first) { const i = first.querySelector('input,textarea'); i && i.focus(); return false; }
    return true;
  };

  let sending = false;
  $('#cform').addEventListener('submit', async e => {
    e.preventDefault();
    if (sending || !check()) return;
    $('#draft').hidden = true;
    if (!online) {
      status('온라인 접수가 아직 연결되지 않아 저장되지 않았습니다. 아래 문안을 문자로 보내 주시거나 전화해 주세요.', 'bad');
      showDraft(isMobile ? '문자 앱을 열어 전송해 주세요.' : `문안을 복사해 ${s.mobile || ''}로 보내 주세요.`);
      return;
    }
    sending = true; btn.disabled = true; btn.textContent = '보내는 중…'; status('신청 내용을 보내고 있습니다.', '');
    const payload = { company: val('#company'), name: val('#cname'), phone: val('#phone').replace(/\s/g, ''), field: fieldName(),
      message: val('#cmsg'), consent: $('#agree').checked, consent_version: s.consent_version || '', page: location.pathname + location.hash, website: $('#website').value };
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      // text/plain 으로 보내 브라우저 사전 확인 요청 없이 Apps Script 로 전달
      const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), signal: ctrl.signal });
      const res = await r.json();
      if (res.ok) {
        $('#cform').querySelectorAll('.f,.grid2,.hint,#submitBtn,.hp').forEach(n => n.hidden = true);
        status('', ''); $('#doneText').textContent = `${res.id ? `접수번호 ${res.id} · ` : ''}담당자가 확인 후 남겨 주신 연락처로 연락드립니다. 급하시면 ${s.phone || ''}로 전화 주세요.`;
        $('#done').hidden = false; $('#done').focus();
      } else if (res.error === 'too_soon') {
        status('조금 전에 같은 연락처로 신청이 접수되었습니다. 잠시 후 다시 시도하시거나 전화로 문의해 주세요.', 'bad');
      } else if (res.error === 'invalid') {
        status('입력하신 내용을 다시 확인해 주세요.', 'bad'); check();
      } else throw new Error(res.error || 'server');
    } catch (err) {
      status('신청을 보내지 못했습니다. 입력하신 내용은 그대로 있습니다. 다시 시도하시거나 아래 문안을 문자로 보내 주세요.', 'bad');
      showDraft(isMobile ? '문자 앱을 열어 전송해 주세요.' : `문안을 복사해 ${s.mobile || ''}로 보내 주세요.`);
    } finally { clearTimeout(timer); sending = false; btn.disabled = false; btn.textContent = '상담 신청하기'; }
  });
  $('#smsBtn').addEventListener('click', () => status('문자 앱을 열었습니다. 문자 앱에서 전송을 눌러야 발송됩니다.', ''));
  $('#copyBtn').addEventListener('click', async () => {
    const ta = $('#draftText');
    try { await navigator.clipboard.writeText(ta.value); status('문안을 복사했습니다. 문자나 메신저에 붙여넣어 보내 주세요.', ''); }
    catch { ta.focus(); ta.select(); status('자동 복사가 막혀 있습니다. 문안을 선택해 두었으니 직접 복사해 주세요.', ''); }
  });
};


/* ---------- NEWS ---------- */
const NCAT = {policy: '정책·법률', incident: '사건·사고', market: '시장·시세', presale: '신규 분양', rodeo: '로데오 상권'};
R.news = async () => {
  const d = await load('news');
  $('#newsIntro').textContent = d.intro || '';
  const items = (d.items || []).filter(x => x.published && x.slug && x.title).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  let cat = 'all';
  const cats = ['all', ...Object.keys(NCAT).filter(k => items.some(x => x.category === k))];
  $('#newsCats').innerHTML = cats.length > 2 ? cats.map(k => `<button type="button" data-c="${k}" aria-pressed="${k === cat}">${k === 'all' ? '전체' : NCAT[k]}</button>`).join('') : '';
  const list = () => {
    const xs = items.filter(x => cat === 'all' || x.category === cat);
    $('#nlist').innerHTML = xs.map(x => `<li class="nitem"><a href="#${esc(x.slug)}"><time datetime="${esc(x.date)}">${esc(String(x.date || '').replace(/-/g, '.'))}</time><div><span class="cat ${esc(x.category)}">${esc(NCAT[x.category] || '')}</span><h3>${esc(x.title)}</h3><p>${esc(x.summary)}</p>${x.opinion ? `<p class="op">${esc(x.opinion_by || '현장의 한마디')}: ${esc(String(x.opinion).slice(0, 70))}${String(x.opinion).length > 70 ? '…' : ''}</p>` : ''}</div><span class="ar" aria-hidden="true">→</span></a></li>`).join('');
    $('#newsEmpty').hidden = items.length > 0;
  };
  $('#newsCats').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; cat = b.dataset.c; $$('#newsCats button').forEach(x => x.setAttribute('aria-pressed', x === b)); list(); });
  const show = () => {
    const x = items.find(i => i.slug === decodeURIComponent(location.hash.slice(1)));
    $('#newsList').hidden = !!x; $('#phead').hidden = !!x; $('#newsArticle').hidden = !x;
    if (!x) { document.title = 'NEWS · 로데오공인중개사무소'; return; }
    const srcs = (x.sources || []).filter(s => s.name);
    $('#newsArticle').innerHTML = `<p class="crumb"><a href="news.html">NEWS</a> / ${esc(NCAT[x.category] || '')}</p>
      <h1 class="atitle" tabindex="-1">${esc(x.title)}</h1><p class="lead"><time datetime="${esc(x.date)}">${esc(String(x.date || '').replace(/-/g, '.'))}</time> · ${esc(x.summary)}</p>
      ${x.body ? `<div class="prose abody">${clean(x.body)}</div>` : ''}
      ${x.opinion ? `<aside class="opinion"><p class="who">${esc(x.opinion_by || '현장의 한마디')}</p><p>${br(x.opinion)}</p></aside>` : ''}
      ${srcs.length ? `<div class="sources"><h3>출처</h3><ul>${srcs.map(s => `<li>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>` : esc(s.name)}${s.date ? ` · ${esc(s.date)}` : ''}</li>`).join('')}</ul></div>` : ''}
      <p class="note">기사와 발표 내용을 요약하고 견해를 덧붙인 글입니다. 법률·세무 판단은 전문가 확인이 필요합니다.</p>
      <div class="acts"><a class="btn" href="news.html">목록으로</a><a class="btn cta" href="contact.html#consult">이 소식으로 상담하기</a></div>`;
    document.title = `${x.title} · NEWS · 로데오공인중개사무소`;
    scrollTo(0, 0); $('#newsArticle h1').focus({preventScroll: true});
  };
  list(); addEventListener('hashchange', show); show();
};

/* ---------- Q&A ---------- */
const qaItem = (q, a, i, by) => `<div class="qa" style="animation-delay:${matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : i * 70}ms"><button type="button" aria-expanded="false"><span class="qm">Q</span><span>${esc(q)}</span><span class="pm" aria-hidden="true"></span></button><div class="ans" role="region"><div><p>${br(a)}</p>${by ? `<p class="by">${esc(by)}</p>` : ''}</div></div></div>`;
const bindQa = root => root.addEventListener('click', e => { const b = e.target.closest('.qa > button'); if (!b) return; const it = b.parentElement, o = !it.classList.contains('open'); it.classList.toggle('open', o); b.setAttribute('aria-expanded', o); });
R.qna = async () => {
  const d = await load('qna');
  $('#qnaIntro').textContent = d.intro || '';
  const groups = (d.faq || []).filter(g => (g.items || []).length);
  let gi = 0;
  const drawFaq = () => {
    $('#qtabs').innerHTML = groups.map((g, i) => `<button type="button" role="tab" aria-selected="${i === gi}" data-i="${i}">${esc(g.group)}</button>`).join('');
    $('#faq').innerHTML = (groups[gi] ? groups[gi].items : []).map((x, i) => qaItem(x.q, x.a, i)).join('');
  };
  $('#qtabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; gi = +b.dataset.i; drawFaq(); });
  bindQa($('#faq')); drawFaq();

  const s = await site;
  const endpoint = String(s.form_endpoint || '').trim(), online = /^https:\/\//.test(endpoint);

  /* ----- 게시판 ----- */
  const PAGE = 10; let all = [], shown = PAGE, freshId = null;
  const today = new Date(); const isNew = d => (today - new Date(d + 'T00:00:00+09:00')) / 864e5 < 3;
  const LOCK = '<svg class="lock" viewBox="0 0 24 24" aria-label="비밀글"><path fill="currentColor" d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zm-7-2a2 2 0 0 1 4 0v2h-4z"/></svg>';
  const viewed = id => { try { return sessionStorage.getItem('v_' + id); } catch { return null; } };
  const markViewed = id => { try { sessionStorage.setItem('v_' + id, 1); } catch {} };
  const drawBoard = () => {
    const list = all.slice(0, shown), total = all.length;
    $('#bcount').textContent = total ? `전체 ${total}건` : '';
    $('#bempty').hidden = total > 0;
    $('#blist').innerHTML = list.map((x, i) => `<div class="bitem${x.id === freshId ? ' fresh' : ''}" data-id="${esc(x.id)}" role="row"><button type="button" aria-expanded="false" class="brow">
      <span class="n" role="cell">${total - i}</span><span class="fd" role="cell">${esc(x.field || '')}</span>
      <span class="t" role="cell">${x.secret ? LOCK : ''}<span class="tx">${esc(x.title)}</span>${isNew(x.date) ? '<span class="badge new">NEW</span>' : ''}${x.answered ? '<span class="badge ans">답변완료</span>' : '<span class="badge wait">답변대기</span>'}</span>
      <span class="a" role="cell">${esc(x.author)}</span><span class="d" role="cell">${esc(String(x.date).replace(/-/g, '.'))}</span><span class="v" role="cell">조회 ${x.views}</span>
      <span class="meta">${esc(x.author)} · ${esc(String(x.date).replace(/-/g, '.'))}</span></button>
      <div class="bdetail" role="region"><div><div class="bbody">불러오는 중…</div></div></div></div>`).join('');
    $('#bmore').hidden = total <= shown;
    $('#bmore').textContent = `더보기 (${Math.min(PAGE, total - shown)}건 더)`;
  };
  const loadBoard = async () => {
    if (!online) { $('#bempty').hidden = false; return; }
    try { const r = await fetch(`${endpoint}?action=list`); const j = await r.json(); if (!j.ok) throw 0; all = j.items || []; $('#berr').hidden = true; drawBoard(); }
    catch { $('#berr').hidden = false; }
  };
  $('#bmore').addEventListener('click', () => { shown += PAGE; drawBoard(); });
  $('#blist').addEventListener('click', async e => {
    const b = e.target.closest('.bitem > button'); if (!b) return;
    const it = b.parentElement, id = it.dataset.id, open = !it.classList.contains('open');
    it.classList.toggle('open', open); b.setAttribute('aria-expanded', open);
    if (!open || it.dataset.loaded) return;
    const body = it.querySelector('.bbody');
    try {
      const p = await (await fetch(`${endpoint}?action=post&id=${encodeURIComponent(id)}`)).json();
      if (!p.ok) throw 0;
      it.dataset.loaded = 1;
      if (p.secret) body.innerHTML = `<p class="pend">비밀글입니다. 작성자에게 남겨 주신 연락처로 답변드립니다.${p.answered ? ' (답변 완료)' : ''}</p>`;
      else body.innerHTML = `<p class="qtxt">${esc(p.question)}</p>${p.answer ? `<div class="ansbox"><p class="who">${esc(p.answered_by || '로데오공인중개사무소')} 답변${p.answer_date ? ' · ' + esc(p.answer_date.replace(/-/g, '.')) : ''}</p><p>${esc(p.answer)}</p></div>` : '<p class="pend">답변을 준비하고 있습니다. 급하시면 카카오톡이나 전화로 문의해 주세요.</p>'}`;
      if (!viewed(id)) {
        markViewed(id);
        fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify({type: 'view', id})}).catch(() => {});
        const x = all.find(a => a.id === id); if (x) { x.views++; const v = it.querySelector('.v'); if (v) v.textContent = `조회 ${x.views}`; }
      }
    } catch { body.innerHTML = '<p class="pend">글을 불러오지 못했습니다. 잠시 후 다시 눌러 주세요.</p>'; }
  });
  loadBoard();

  /* ----- 질문하기 ----- */
  if (!online) $('#qMode').textContent = '온라인 질문 접수를 연결하는 중입니다. 지금은 카카오톡이나 전화로 문의해 주세요.';
  const st = (t, k) => { const el = $('#qStatus'); el.hidden = !t; el.textContent = t || ''; el.className = 'status' + (k ? ' ' + k : ''); };
  let sending = false;
  $('#qform').addEventListener('submit', async e => {
    e.preventDefault(); if (sending) return;
    const title = $('#qtitle').value.trim(), q = $('#qtext').value.trim(), ph = $('#qphone').value.replace(/\s/g, ''), nick = $('#qnick').value.trim();
    const ok = { fQT: !!title, fQ: !!q, fQPhone: !ph || /^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(ph), fQAgree: (!ph && !nick) || $('#qagree').checked };
    let first = null; for (const k in ok) { const f = document.getElementById(k); f.classList.toggle('bad', !ok[k]); if (!ok[k] && !first) first = f; }
    if (first) { const i = first.querySelector('input,textarea'); i && i.focus(); return; }
    if (!online) return st('온라인 질문 접수가 아직 연결되지 않아 저장되지 않았습니다. 카카오톡이나 전화로 문의해 주세요.', 'bad');
    sending = true; $('#qBtn').disabled = true; $('#qBtn').textContent = '올리는 중…'; st('질문을 올리고 있습니다.');
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const secret = (document.querySelector('input[name=qvis]:checked') || {}).value === 'secret';
      const r = await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, signal: ctrl.signal, body: JSON.stringify({
        type: 'question', field: $('#qfield').value, title, question: q, nickname: nick, phone: ph, secret,
        consent: $('#qagree').checked, consent_version: s.consent_version || '', website: $('#qwebsite').value})});
      const res = await r.json();
      if (res.ok) {
        st(`질문이 올라갔습니다${res.id ? ` (접수번호 ${res.id})` : ''}. ${ph ? '남겨 주신 연락처로 답변드립니다.' : '답변은 아래 게시판에서 확인하실 수 있습니다.'}`, 'ok');
        ['#qtitle', '#qtext', '#qphone', '#qnick'].forEach(id => $(id).value = ''); $('#qagree').checked = false;
        freshId = res.id; shown = PAGE; await loadBoard(); $('#board').scrollIntoView({behavior: 'smooth', block: 'start'});
      } else if (res.error === 'too_soon') st('조금 전에 질문이 올라갔습니다. 잠시 후 다시 시도해 주세요.', 'bad');
      else throw new Error(res.error || 'server');
    } catch { st('질문을 올리지 못했습니다. 입력하신 내용은 그대로 있습니다. 다시 시도하시거나 카카오톡으로 문의해 주세요.', 'bad'); }
    finally { clearTimeout(t); sending = false; $('#qBtn').disabled = false; $('#qBtn').textContent = '질문 올리기'; }
  });
};

function scrollToHash() { const id = decodeURIComponent(location.hash.slice(1)); const el = id && document.getElementById(id); if (el) requestAnimationFrame(() => el.scrollIntoView({block: 'start'})); }

if (R[PAGE]) R[PAGE]().catch(err => { console.error(err); fail('내용을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.'); });
}
