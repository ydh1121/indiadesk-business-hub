import { renderMarkdownSafe, escapeHtml } from './markdown.js';

const state = { me: null, csrf: '', view: 'plans', version: 'v1', contents: [], documents: [], admin: {} };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function deviceInfo() {
  const ua = navigator.userAgent;
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || Math.min(screen.width, screen.height) < 800;
  let os = 'Unknown';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS/iPadOS';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  let browser = 'Other';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  return { category: isMobile ? 'mobile' : 'pc', os, browser, userAgent: ua.slice(0, 500), screen: `${screen.width}x${screen.height}` };
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (state.csrf && !['GET', 'HEAD'].includes((options.method || 'GET').toUpperCase())) headers.set('x-csrf-token', state.csrf);
  const response = await fetch(path, { ...options, headers, credentials: 'same-origin' });
  const data = await response.json().catch(() => ({ ok: false, error: '응답을 해석할 수 없습니다.' }));
  if (response.status === 401 && path !== '/api/login') showLogin();
  if (!response.ok || data.ok === false) throw new Error(data.error || `요청 실패 (${response.status})`);
  return data;
}

function toast(message) {
  const el = $('#toast'); el.textContent = message; el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 2600);
}

function showLogin() { $('#app').classList.add('hidden'); $('#loginPage').classList.remove('hidden'); state.me = null; state.csrf = ''; }
function showApp() {
  $('#loginPage').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#sideName').textContent = state.me.displayName || state.me.username;
  $('#sideRole').textContent = state.me.role === 'admin' ? 'ADMIN · 기기 제한 없음' : 'GUEST · PC 1 + MOBILE 1';
  $('#sessionInfo').textContent = `${state.me.username} · ${deviceInfo().category.toUpperCase()}`;
  $('#adminNav').classList.toggle('hidden', state.me.role !== 'admin');
  $('#mobileAdminNav').classList.toggle('hidden', state.me.role !== 'admin');
}

function hero() {
  return `<section class="hero"><div class="brand-kicker">Integrated Business Workspace</div><h2>인도진출 파트너·시장검증·거래 플랫폼</h2><p>IBS 현지교육을 기반으로 한국 영업망을 구축하고, Indiadesk 멀티피드에서 기업을 유입한 뒤 시장검증·IBS 실행·Ctrl Shift Trade 거래로 전환합니다.</p><div class="metric-grid"><div class="metric-card"><strong>20명</strong><span>1기 영업 파트너</span></div><div class="metric-card"><strong>4억 원</strong><span>1기 교육매출</span></div><div class="metric-card"><strong>0원</strong><span>1기 계획 잔여</span></div><div class="metric-card"><strong>10기</strong><span>누적 확장계획</span></div></div></section>`;
}

async function loadContents() { const data = await api('/api/content'); state.contents = data.items || []; }
async function loadDocuments() { const data = await api('/api/documents'); state.documents = data.items || []; }

function contentCard(item) {
  const edit = state.me.role === 'admin' ? `<button class="ghost edit-btn" data-edit-content="${escapeHtml(item.pageKey)}|${escapeHtml(item.sectionKey)}">내용 수정</button>` : '';
  return `<article class="content-card"><div class="content-card-head"><div><div class="eyebrow">${escapeHtml(item.pageKey.toUpperCase())} · ${String(item.sortOrder).padStart(2,'0')}</div><h3>${escapeHtml(item.title)}</h3></div>${edit}</div><div class="content-card-body">${renderMarkdownSafe(item.bodyMarkdown)}</div></article>`;
}

async function renderPlans() {
  if (!state.contents.length) await loadContents();
  const items = state.contents.filter((x) => x.pageKey === state.version).sort((a,b) => a.sortOrder-b.sortOrder);
  $('#content').innerHTML = `${hero()}<div class="page-toolbar"><div class="tabs"><button class="tab ${state.version==='v1'?'active':''}" data-version="v1">Version 1 · 양성사업</button><button class="tab ${state.version==='v2'?'active':''}" data-version="v2">Version 2 · 통합사업</button></div>${state.me.role==='admin'?'<button id="initializeContent" class="secondary">기본 내용 시트에 초기화</button>':''}</div><div class="section-list">${items.map(contentCard).join('')}</div>`;
}

function renderArchitecture() {
  const steps = [
    ['01','콘텐츠·정보','Indiadesk 피드, 프레스, 세미나, 시행사 고객DB'],
    ['02','파트너 선발','20명 유료 선발, IBS 30일 기본과정'],
    ['03','기업 유입','기업·제품·오더 등록, 보호정보 승인'],
    ['04','시장검증','현장·소비자·가격·패키지·채널 검증'],
    ['05','IBS 실행','법인·공장·인증·부동산·쇼룸·현지관리'],
    ['06','Ctrl Shift 거래','조건매칭·제안·협상·MOQ·계약·정산'],
    ['07','반복수익','수출·리테이너·제휴·구독·고급과정']
  ];
  $('#content').innerHTML = `${hero()}<div class="page-toolbar"><h2>Full Funnel 아키텍처</h2></div><div class="section-list">${steps.map(([n,t,d])=>`<article class="content-card"><div class="content-card-head"><div><div class="eyebrow">STEP ${n}</div><h3>${t}</h3></div></div><div class="content-card-body"><p>${d}</p></div></article>`).join('')}</div>`;
}

async function renderDocuments() {
  if (!state.documents.length) await loadDocuments();
  const cards = state.documents.map((doc) => {
    const ready = Boolean(doc.fileUrl);
    const button = ready ? `<a class="primary" href="${escapeHtml(doc.fileUrl)}" download>PDF 다운로드</a>` : `<button class="secondary" disabled>내용 확정 후 작성</button>`;
    const edit = state.me.role === 'admin' ? `<button class="ghost" data-edit-document="${escapeHtml(doc.id)}">메타데이터 수정</button>` : '';
    return `<article class="doc-card"><div class="doc-meta"><span class="badge">${escapeHtml(doc.category)}</span><span class="badge ${ready?'':'pending'}">${escapeHtml(doc.status)}</span><span class="badge">${escapeHtml(doc.version)}</span></div><h3>${escapeHtml(doc.title)}</h3><p class="small muted"><strong>용도</strong> · ${escapeHtml(doc.purpose)}</p><p>${escapeHtml(doc.description)}</p><div class="doc-actions">${button}${edit}</div></article>`;
  }).join('');
  $('#content').innerHTML = `${hero()}<div class="page-toolbar"><div><h2>문서 다운로드</h2><p class="muted">사업계획서와 실행에 필요한 계약·운영·정산·플랫폼 문서의 용도와 작성상태를 관리합니다.</p></div></div><div class="doc-grid">${cards}</div>`;
}

async function renderAdmin() {
  if (state.me.role !== 'admin') return navigate('plans');
  const [accounts, devices, logs] = await Promise.all([api('/api/admin/accounts'), api('/api/admin/devices'), api('/api/admin/logs')]);
  state.admin = { accounts: accounts.items || [], devices: devices.items || [], logs: logs.items || [] };
  const accountRows = state.admin.accounts.map((a) => `<tr><td><span class="status-dot ${escapeHtml(a.status)}"></span>${escapeHtml(a.username)}</td><td>${escapeHtml(a.displayName)}</td><td>${escapeHtml(a.role)}</td><td>${escapeHtml(a.status)}</td><td>${escapeHtml(a.devicePolicy)}</td><td>${a.pcLimit}</td><td>${a.mobileLimit}</td><td><div class="inline-actions"><button class="secondary" data-account-edit="${escapeHtml(a.username)}">설정</button><button class="ghost" data-account-password="${escapeHtml(a.username)}">비밀번호</button></div></td></tr>`).join('');
  const deviceRows = state.admin.devices.slice().reverse().slice(0,200).map((d) => `<tr><td>${escapeHtml(d.username)}</td><td>${escapeHtml(d.category)}</td><td>${escapeHtml(d.os)}</td><td>${escapeHtml(d.browser)}</td><td>${escapeHtml(d.country)} ${escapeHtml(d.city)}</td><td>${escapeHtml(d.lastIp)}</td><td>${escapeHtml(d.lastSeen)}</td><td>${d.active?'활성':'해제'}</td><td><button class="${d.active?'danger':'secondary'}" data-device-toggle="${escapeHtml(d.deviceId)}" data-device-active="${d.active}">${d.active?'해제':'활성화'}</button></td></tr>`).join('');
  const logRows = state.admin.logs.slice().reverse().slice(0,200).map((l) => `<tr><td>${escapeHtml(l.timestamp)}</td><td>${escapeHtml(l.username)}</td><td>${escapeHtml(l.event)}</td><td>${l.success?'성공':'실패'}</td><td>${escapeHtml(l.reason)}</td><td>${escapeHtml(l.ip)}</td><td>${escapeHtml(l.country)} ${escapeHtml(l.city)}</td><td>${escapeHtml(l.category)} · ${escapeHtml(l.os)}</td></tr>`).join('');
  $('#content').innerHTML = `<div class="page-toolbar"><div><h2>관리자</h2><p class="muted">계정·기기·접속기록과 콘텐츠·문서 메타데이터를 관리합니다.</p></div></div><div class="admin-grid"><section class="admin-card"><h3>계정</h3><div class="table-wrap"><table class="admin-table"><thead><tr><th>계정</th><th>표시명</th><th>역할</th><th>상태</th><th>초과정책</th><th>PC</th><th>모바일</th><th>관리</th></tr></thead><tbody>${accountRows}</tbody></table></div></section><section class="admin-card"><h3>등록 기기</h3><div class="table-wrap"><table class="admin-table"><thead><tr><th>계정</th><th>분류</th><th>OS</th><th>브라우저</th><th>국가·도시</th><th>최근 IP</th><th>최근 접속</th><th>상태</th><th>관리</th></tr></thead><tbody>${deviceRows}</tbody></table></div></section><section class="admin-card"><h3>접속 로그</h3><div class="table-wrap"><table class="admin-table"><thead><tr><th>시간</th><th>계정</th><th>이벤트</th><th>결과</th><th>사유</th><th>IP</th><th>국가·도시</th><th>기기</th></tr></thead><tbody>${logRows}</tbody></table></div></section></div>`;
}

async function navigate(view) {
  state.view = view;
  $$('.nav-button, .mobile-nav button').forEach((el) => el.classList.toggle('active', el.dataset.view === view));
  $('#viewTitle').textContent = ({plans:'사업계획서',architecture:'통합 아키텍처',documents:'문서 다운로드',admin:'관리자'})[view];
  $('#content').innerHTML = '<div class="loading">내용을 불러오는 중입니다.</div>';
  try {
    if (view === 'plans') await renderPlans();
    else if (view === 'architecture') renderArchitecture();
    else if (view === 'documents') await renderDocuments();
    else if (view === 'admin') await renderAdmin();
  } catch (error) { $('#content').innerHTML = `<div class="error-box">${escapeHtml(error.message)}</div>`; }
}

function modal(title, body, actions = '') {
  $('#modalRoot').innerHTML = `<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h3>${escapeHtml(title)}</h3><button class="icon-button" data-close-modal>×</button></div>${body}<div class="modal-actions">${actions}</div></div></div>`;
}
function closeModal() { $('#modalRoot').innerHTML = ''; }

function openContentEditor(key) {
  const [pageKey, sectionKey] = key.split('|');
  const item = state.contents.find((x) => x.pageKey === pageKey && x.sectionKey === sectionKey);
  modal('내용 수정', `<form id="contentEditForm"><input type="hidden" name="pageKey" value="${escapeHtml(pageKey)}"><input type="hidden" name="sectionKey" value="${escapeHtml(sectionKey)}"><div class="field"><label>제목</label><input name="title" value="${escapeHtml(item.title)}" required></div><div class="field"><label>본문 · Markdown</label><textarea name="bodyMarkdown" required>${escapeHtml(item.bodyMarkdown)}</textarea></div><div class="field"><label>정렬</label><input name="sortOrder" type="number" value="${item.sortOrder}"></div></form>`, '<button class="ghost" data-close-modal>취소</button><button class="primary" data-save-content>저장</button>');
}

function openAccountEditor(username) {
  const a = state.admin.accounts.find((x) => x.username === username);
  modal(`${username} 계정 설정`, `<form id="accountEditForm"><input type="hidden" name="username" value="${escapeHtml(username)}"><div class="field"><label>표시명</label><input name="displayName" value="${escapeHtml(a.displayName)}"></div><div class="field"><label>상태</label><select name="status"><option value="active" ${a.status==='active'?'selected':''}>active</option><option value="pending" ${a.status==='pending'?'selected':''}>pending</option><option value="disabled" ${a.status==='disabled'?'selected':''}>disabled</option></select></div><div class="field"><label>새 기기 초과 시</label><select name="devicePolicy"><option value="BLOCK" ${a.devicePolicy==='BLOCK'?'selected':''}>BLOCK · 로그인 차단</option><option value="REPLACE" ${a.devicePolicy==='REPLACE'?'selected':''}>REPLACE · 기존기기 해제 후 허용</option><option value="ALLOW" ${a.devicePolicy==='ALLOW'?'selected':''}>ALLOW · 제한 초과 허용</option></select></div><div class="field"><label>PC 제한</label><input type="number" name="pcLimit" min="0" max="10" value="${a.pcLimit}"></div><div class="field"><label>모바일 제한</label><input type="number" name="mobileLimit" min="0" max="10" value="${a.mobileLimit}"></div></form>`, '<button class="ghost" data-close-modal>취소</button><button class="primary" data-save-account>저장</button>');
}

function openPasswordEditor(username) {
  modal(`${username} 비밀번호 설정`, `<form id="passwordEditForm"><input type="hidden" name="username" value="${escapeHtml(username)}"><div class="field"><label>새 비밀번호</label><input type="password" name="password" minlength="10" required></div><div class="field"><label>새 비밀번호 확인</label><input type="password" name="confirm" minlength="10" required></div></form>`, '<button class="ghost" data-close-modal>취소</button><button class="primary" data-save-password>변경</button>');
}

function openDocumentEditor(id) {
  const d = state.documents.find((x) => x.id === id);
  modal('문서 메타데이터 수정', `<form id="documentEditForm"><input type="hidden" name="id" value="${escapeHtml(id)}"><div class="field"><label>문서명</label><input name="title" value="${escapeHtml(d.title)}"></div><div class="field"><label>용도</label><input name="purpose" value="${escapeHtml(d.purpose)}"></div><div class="field"><label>설명</label><textarea name="description" style="min-height:120px">${escapeHtml(d.description)}</textarea></div><div class="field"><label>상태</label><input name="status" value="${escapeHtml(d.status)}"></div><div class="field"><label>파일 URL</label><input name="fileUrl" value="${escapeHtml(d.fileUrl)}"></div><div class="field"><label>버전</label><input name="version" value="${escapeHtml(d.version)}"></div></form>`, '<button class="ghost" data-close-modal>취소</button><button class="primary" data-save-document>저장</button>');
}

async function bootstrapModal() {
  modal('관리자 최초 설정', `<form id="bootstrapForm"><div class="field"><label>Bootstrap Secret</label><input type="password" name="bootstrapSecret" required></div><div class="field"><label>Admin 비밀번호</label><input type="password" name="password" minlength="12" required></div><div class="field"><label>비밀번호 확인</label><input type="password" name="confirm" minlength="12" required></div></form>`, '<button class="ghost" data-close-modal>취소</button><button class="primary" data-bootstrap-save>설정</button>');
}

$('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const msg = $('#loginMessage'); msg.innerHTML = '';
  try {
    const data = await api('/api/login', { method: 'POST', body: JSON.stringify({ username: $('#username').value.trim(), password: $('#password').value, device: deviceInfo() }) });
    state.me = data.user; state.csrf = data.csrf; showApp(); await navigate('plans');
  } catch (error) { msg.innerHTML = `<div class="error-box">${escapeHtml(error.message)}</div>`; }
});

$('#bootstrapOpen').addEventListener('click', bootstrapModal);
$('#logoutButton').addEventListener('click', async () => { try { await api('/api/logout', {method:'POST'}); } finally { showLogin(); } });

window.addEventListener('click', async (event) => {
  const target = event.target.closest('button,a'); if (!target) return;
  if (target.dataset.view) { event.preventDefault(); return navigate(target.dataset.view); }
  if (target.dataset.version) { state.version = target.dataset.version; return renderPlans(); }
  if (target.dataset.closeModal !== undefined) return closeModal();
  if (target.dataset.editContent) return openContentEditor(target.dataset.editContent);
  if (target.dataset.accountEdit) return openAccountEditor(target.dataset.accountEdit);
  if (target.dataset.accountPassword) return openPasswordEditor(target.dataset.accountPassword);
  if (target.dataset.editDocument) return openDocumentEditor(target.dataset.editDocument);
  if (target.id === 'initializeContent') {
    if (!confirm('기본 내용을 Google Sheets Content 탭에 초기화합니다. 기존 동일 섹션은 유지됩니다.')) return;
    await api('/api/admin/initialize-content', { method:'POST', body:'{}' }); state.contents=[]; toast('기본 내용이 초기화되었습니다.'); return renderPlans();
  }
  if (target.dataset.saveContent !== undefined) {
    const form = new FormData($('#contentEditForm'));
    await api('/api/content', {method:'PUT', body:JSON.stringify(Object.fromEntries(form))}); closeModal(); state.contents=[]; toast('내용을 저장했습니다.'); return renderPlans();
  }
  if (target.dataset.saveAccount !== undefined) {
    const payload=Object.fromEntries(new FormData($('#accountEditForm'))); payload.pcLimit=Number(payload.pcLimit); payload.mobileLimit=Number(payload.mobileLimit);
    await api('/api/admin/accounts',{method:'PUT',body:JSON.stringify(payload)}); closeModal(); toast('계정 설정을 저장했습니다.'); return renderAdmin();
  }
  if (target.dataset.savePassword !== undefined) {
    const payload=Object.fromEntries(new FormData($('#passwordEditForm'))); if(payload.password!==payload.confirm) return alert('비밀번호가 일치하지 않습니다.');
    await api('/api/admin/accounts',{method:'PUT',body:JSON.stringify({username:payload.username,password:payload.password,status:'active'})}); closeModal(); toast('비밀번호를 설정했습니다.'); return renderAdmin();
  }
  if (target.dataset.deviceToggle) {
    await api('/api/admin/devices',{method:'PUT',body:JSON.stringify({deviceId:target.dataset.deviceToggle,active:target.dataset.deviceActive!=='true'})}); toast('기기 상태를 변경했습니다.'); return renderAdmin();
  }
  if (target.dataset.saveDocument !== undefined) {
    const payload=Object.fromEntries(new FormData($('#documentEditForm'))); await api('/api/documents',{method:'PUT',body:JSON.stringify(payload)}); closeModal(); state.documents=[]; toast('문서 정보를 저장했습니다.'); return renderDocuments();
  }
  if (target.dataset.bootstrapSave !== undefined) {
    const payload=Object.fromEntries(new FormData($('#bootstrapForm'))); if(payload.password!==payload.confirm) return alert('비밀번호가 일치하지 않습니다.');
    await api('/api/bootstrap',{method:'POST',body:JSON.stringify({bootstrapSecret:payload.bootstrapSecret,password:payload.password})}); closeModal(); $('#loginMessage').innerHTML='<div class="success-box">Admin 비밀번호가 설정되었습니다. 로그인하세요.</div>'; return;
  }
});

(async function start() {
  try {
    const data = await api('/api/me'); state.me = data.user; state.csrf = data.csrf; showApp(); await navigate('plans');
  } catch { showLogin(); }
})();
