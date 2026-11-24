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
};

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

function scrollToHash() { const id = decodeURIComponent(location.hash.slice(1)); const el = id && document.getElementById(id); if (el) requestAnimationFrame(() => el.scrollIntoView({block: 'start'})); }

if (R[PAGE]) R[PAGE]().catch(err => { console.error(err); fail('내용을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.'); });
}
