import { renderMarkdownSafe, escapeHtml } from './markdown.js';
import { renderArchitectureWorkspace, activateArchitectureNode } from './architecture-ui.js';

const DEFAULT_PLAN_TABS = [
  { pageKey: 'v1', label: 'Version 1 · 기본사업' },
  { pageKey: 'v2', label: 'Version 2 · 통합사업' },
  { pageKey: 'v3', label: 'Version 3 · 실행 오더 데스크' },
  { pageKey: 'v4', label: 'Version 4 · 기업 진출 패키지' },
];

const state = {
  me: null,
  csrf: '',
  view: 'plans',
  version: 'v1',
  contents: [],
  documents: [],
  settings: {},
  settingsLoaded: false,
  access: { initialized: false, allowed: new Set() },
  accessLoaded: false,
  architecture: [],
  notes: [],
  notesLoaded: false,
  admin: {},
};
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

function showLogin() {
  $('#app').classList.add('hidden');
  $('#loginPage').classList.remove('hidden');
  state.me = null;
  state.csrf = '';
  state.access = { initialized: false, allowed: new Set() };
  state.accessLoaded = false;
  state.contents = [];
  state.documents = [];
  state.architecture = [];
  state.notes = [];
  state.notesLoaded = false;
}
function showApp() {
  $('#loginPage').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#sideName').textContent = state.me.displayName || state.me.username;
  $('#sideRole').textContent = state.me.role === 'admin' ? 'ADMIN · 기기 제한 없음' : 'GUEST · 개별 공개 범위';
  $('#sessionInfo').textContent = `${state.me.username} · ${deviceInfo().category.toUpperCase()}`;
  $('#adminNav').classList.toggle('hidden', state.me.role !== 'admin');
  $('#mobileAdminNav').classList.toggle('hidden', state.me.role !== 'admin');
  applyNavigationPermissions();
}

function hero() {
  if (state.view === 'plans' && state.version === 'v4') {
    return `<section class="hero"><div class="brand-kicker">Corporate India Entry Package</div><h2>기업 인도진출 실행 패키지</h2><p>사전 진단과 문서 정비부터 바이어·파트너 후보 선별, IBS 현지 미팅, 시장·유통 확인과 귀국 후 실행계획까지 한 과정으로 관리합니다.</p><div class="metric-grid"><div class="metric-card"><strong>2,000만 원</strong><span>기업당 기본가격</span></div><div class="metric-card"><strong>6박 7일</strong><span>인도 현지일정</span></div><div class="metric-card"><strong>최대 10개</strong><span>사전 후보군 기준</span></div><div class="metric-card"><strong>30·60·90일</strong><span>후속 실행계획</span></div></div></section>`;
  }

  return `<section class="hero"><div class="brand-kicker">Integrated Business Workspace</div><h2>인도진출 파트너·시장검증·거래 플랫폼</h2><p>IBS 현지교육을 기반으로 한국 영업망을 구축하고, Indiadesk 멀티피드에서 기업을 유입한 뒤 시장검증·IBS 실행·Ctrl Shift Trade 거래로 전환합니다.</p><div class="metric-grid"><div class="metric-card"><strong>20명</strong><span>1기 영업 파트너</span></div><div class="metric-card"><strong>4억 원</strong><span>1기 교육매출</span></div><div class="metric-card"><strong>0원</strong><span>기존 30일안 잔여</span></div><div class="metric-card"><strong>10기</strong><span>누적 확장계획</span></div></div></section>`;
}

async function loadContents() { const data = await api('/api/content'); state.contents = data.items || []; }
async function loadDocuments() { const data = await api('/api/documents'); state.documents = data.items || []; }
async function loadNotes() {
  const data = await api('/api/notes');
  state.notes = data.items || [];
  state.notesLoaded = true;
}
async function loadSettings() {
  const data = await api('/api/settings');
  state.settings = data.settings || {};
  state.settingsLoaded = true;
}

async function loadAccess() {
  const data = await api('/api/access');
  state.access = {
    initialized: Boolean(data.initialized),
    allowed: new Set(data.allowed || []),
  };
  state.accessLoaded = true;
}

function canAccess(type, key) {
  if (state.me?.role === 'admin') return true;
  return state.access.allowed.has(`${type}:${key}`);
}

function firstAllowedView() {
  return ['plans', 'architecture', 'documents'].find((view) => canAccess('menu', view)) || null;
}

function applyNavigationPermissions() {
  $$('[data-view]').forEach((element) => {
    const view = element.dataset.view;
    if (!view) return;
    const visible = view === 'admin'
      ? state.me?.role === 'admin'
      : canAccess('menu', view);
    element.classList.toggle('hidden', !visible);
  });
}

function showNoAccessiblePage() {
  state.view = '';
  $('#viewTitle').textContent = '접근 권한';
  $('#content').innerHTML = '<div class="error-box">현재 계정에 공개된 메뉴가 없습니다. 관리자에게 공개 범위를 요청하세요.</div>';
}

function fallbackPlanLabel(pageKey) {
  const known = DEFAULT_PLAN_TABS.find((tab) => tab.pageKey === pageKey);
  return known?.label || pageKey.toUpperCase();
}

function getPlanTabs() {
  const availableKeys = [...new Set(state.contents.map((item) => item.pageKey).filter(Boolean))];
  const availableSet = new Set(availableKeys);
  const tabs = [];
  const used = new Set();

  const addTab = (pageKey, label) => {
    if (!pageKey || !availableSet.has(pageKey) || used.has(pageKey)) return;
    tabs.push({ pageKey, label: label || fallbackPlanLabel(pageKey) });
    used.add(pageKey);
  };

  const raw = state.settings.business_plan_tabs;
  if (raw) {
    try {
      const configured = JSON.parse(raw);
      if (Array.isArray(configured)) {
        configured.forEach((tab) => addTab(tab.page_key || tab.pageKey, tab.label));
      }
    } catch (error) {
      console.warn('business_plan_tabs 설정을 읽지 못했습니다.', error);
    }
  }

  DEFAULT_PLAN_TABS.forEach((tab) => addTab(tab.pageKey, tab.label));
  availableKeys.forEach((pageKey) => addTab(pageKey, fallbackPlanLabel(pageKey)));

  return tabs;
}

function contentCard(item) {
  const actions = [];
  if (state.me.role === 'admin') {
    actions.push(`<button class="ghost edit-btn" data-edit-content="${escapeHtml(item.pageKey)}|${escapeHtml(item.sectionKey)}">내용 수정</button>`);
  } else {
    const note = state.notes.find(
      (candidate) =>
        candidate.pageKey === item.pageKey &&
        candidate.sectionKey === item.sectionKey,
    );
    const noteLabel = note?.noteText ? '메모 있음' : '메모';
    actions.push(`<button class="ghost section-note-button ${note?.noteText ? 'note-has-content' : ''}" data-section-note="${escapeHtml(item.pageKey)}|${escapeHtml(item.sectionKey)}">${noteLabel}</button>`);
  }

  return `<article class="content-card" data-content-section="${escapeHtml(item.pageKey)}|${escapeHtml(item.sectionKey)}"><div class="content-card-head"><div><div class="eyebrow">${escapeHtml(item.pageKey.toUpperCase())} · ${String(item.sortOrder).padStart(2,'0')}</div><h3>${escapeHtml(item.title)}</h3></div><div class="content-card-actions">${actions.join('')}</div></div><div class="content-card-body">${renderMarkdownSafe(item.bodyMarkdown)}</div></article>`;
}

async function renderPlans() {
  if (!state.contents.length) await loadContents();

  if (state.me.role !== 'admin' && !state.notesLoaded) {
    try {
      await loadNotes();
    } catch (error) {
      state.notesLoaded = true;
      console.warn('파트 메모를 불러오지 못했습니다.', error);
    }
  }

  if (!state.settingsLoaded) {
    try {
      await loadSettings();
    } catch (error) {
      state.settingsLoaded = true;
      console.warn('설정 API를 불러오지 못해 기본 탭 구성을 사용합니다.', error);
    }
  }

  const tabs = getPlanTabs();
  if (!tabs.some((tab) => tab.pageKey === state.version)) {
    state.version = tabs[0]?.pageKey || 'v1';
  }

  const items = state.contents
    .filter((item) => item.pageKey === state.version)
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));

  const tabButtons = tabs
    .map((tab) => `<button class="tab ${state.version === tab.pageKey ? 'active' : ''}" data-version="${escapeHtml(tab.pageKey)}">${escapeHtml(tab.label)}</button>`)
    .join('');

  const sections = items.length
    ? items.map(contentCard).join('')
    : '<div class="empty-state">이 버전에 등록된 사업계획서 내용이 없습니다.</div>';

  $('#content').innerHTML = `${hero()}<div class="page-toolbar"><div class="tabs">${tabButtons}</div>${state.me.role==='admin'?'<button id="initializeContent" class="secondary">기본 내용 시트에 초기화</button>':''}</div><div class="section-list">${sections}</div>`;
}

async function renderArchitecture() {
  if (!state.architecture.length) {
    const data = await api('/api/architecture');
    state.architecture = data.items || [];
  }

  $('#content').innerHTML = renderArchitectureWorkspace(
    state.architecture,
    hero(),
  );
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
  const [accounts, devices, logs, notes] = await Promise.all([
    api('/api/admin/accounts'),
    api('/api/admin/devices'),
    api('/api/admin/logs'),
    api('/api/admin/notes'),
  ]);
  state.admin = {
    accounts: accounts.items || [],
    devices: devices.items || [],
    logs: logs.items || [],
    notes: notes.items || [],
  };
  const accountRows = state.admin.accounts.map((a) => {
    const permissionButton = a.role === 'admin' ? '' : `<button class="ghost" data-account-permissions="${escapeHtml(a.username)}">공개 범위</button>`;
    return `<tr><td><span class="status-dot ${escapeHtml(a.status)}"></span>${escapeHtml(a.username)}</td><td>${escapeHtml(a.displayName)}</td><td>${escapeHtml(a.role)}</td><td>${escapeHtml(a.status)}</td><td>${escapeHtml(a.devicePolicy)}</td><td>${a.pcLimit}</td><td>${a.mobileLimit}</td><td><div class="inline-actions"><button class="secondary" data-account-edit="${escapeHtml(a.username)}">설정</button><button class="ghost" data-account-password="${escapeHtml(a.username)}">비밀번호</button>${permissionButton}</div></td></tr>`;
  }).join('');
  const deviceRows = state.admin.devices.slice().reverse().slice(0,200).map((d) => `<tr><td>${escapeHtml(d.username)}</td><td>${escapeHtml(d.category)}</td><td>${escapeHtml(d.os)}</td><td>${escapeHtml(d.browser)}</td><td>${escapeHtml(d.country)} ${escapeHtml(d.city)}</td><td>${escapeHtml(d.lastIp)}</td><td>${escapeHtml(d.lastSeen)}</td><td>${d.active?'활성':'해제'}</td><td><button class="${d.active?'danger':'secondary'}" data-device-toggle="${escapeHtml(d.deviceId)}" data-device-active="${d.active}">${d.active?'해제':'활성화'}</button></td></tr>`).join('');
  const logRows = state.admin.logs.slice().reverse().slice(0,200).map((l) => `<tr><td>${escapeHtml(l.timestamp)}</td><td>${escapeHtml(l.username)}</td><td>${escapeHtml(l.event)}</td><td>${l.success?'성공':'실패'}</td><td>${escapeHtml(l.reason)}</td><td>${escapeHtml(l.ip)}</td><td>${escapeHtml(l.country)} ${escapeHtml(l.city)}</td><td>${escapeHtml(l.category)} · ${escapeHtml(l.os)}</td></tr>`).join('');
  const noteRows = state.admin.notes
    .slice()
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, 500)
    .map((note) => `<tr><td>${escapeHtml(note.updatedAt)}</td><td>${escapeHtml(note.username)}</td><td>${escapeHtml(note.pageKey.toUpperCase())}</td><td>${escapeHtml(note.sectionTitle || note.sectionKey)}</td><td><div class="admin-note-text">${escapeHtml(note.noteText)}</div></td><td>${note.status === 'reviewed' ? '검토 완료' : '검토 전'}</td></tr>`)
    .join('');
  const noteEmpty = '<tr><td colspan="6" class="muted">등록된 파트 메모가 없습니다.</td></tr>';
  $('#content').innerHTML = `<div class="page-toolbar"><div><h2>관리자</h2><p class="muted">계정·기기·접속기록, 콘텐츠와 게스트의 파트별 메모를 관리합니다.</p></div><button class="primary" data-create-account>신규 유저 추가</button></div><div class="admin-grid"><section class="admin-card"><h3>계정</h3><div class="table-wrap"><table class="admin-table"><thead><tr><th>계정</th><th>표시명</th><th>역할</th><th>상태</th><th>초과정책</th><th>PC</th><th>모바일</th><th>관리</th></tr></thead><tbody>${accountRows}</tbody></table></div></section><section class="admin-card"><h3>파트별 메모</h3><p class="small muted">게스트가 사업계획서 각 파트에 남긴 아이디어입니다.</p><div class="table-wrap"><table class="admin-table notes-admin-table"><thead><tr><th>수정시간</th><th>계정</th><th>버전</th><th>파트</th><th>메모</th><th>상태</th></tr></thead><tbody>${noteRows || noteEmpty}</tbody></table></div></section><section class="admin-card"><h3>등록 기기</h3><div class="table-wrap"><table class="admin-table"><thead><tr><th>계정</th><th>분류</th><th>OS</th><th>브라우저</th><th>국가·도시</th><th>최근 IP</th><th>최근 접속</th><th>상태</th><th>관리</th></tr></thead><tbody>${deviceRows}</tbody></table></div></section><section class="admin-card"><h3>접속 로그</h3><div class="table-wrap"><table class="admin-table"><thead><tr><th>시간</th><th>계정</th><th>이벤트</th><th>결과</th><th>사유</th><th>IP</th><th>국가·도시</th><th>기기</th></tr></thead><tbody>${logRows}</tbody></table></div></section></div>`;
}

async function navigate(view) {
  if (view === 'admin' && state.me?.role !== 'admin') {
    const fallback = firstAllowedView();
    if (fallback) return navigate(fallback);
    return showNoAccessiblePage();
  }

  if (view !== 'admin' && !canAccess('menu', view)) {
    const fallback = firstAllowedView();
    if (fallback && fallback !== view) return navigate(fallback);
    return showNoAccessiblePage();
  }

  state.view = view;
  $$('.nav-button, .mobile-nav button').forEach((el) => el.classList.toggle('active', el.dataset.view === view));
  $('#viewTitle').textContent = ({plans:'사업계획서',architecture:'통합 아키텍처',documents:'문서 다운로드',admin:'관리자'})[view];
  $('#content').innerHTML = '<div class="loading">내용을 불러오는 중입니다.</div>';
  try {
    if (view === 'plans') await renderPlans();
    else if (view === 'architecture') await renderArchitecture();
    else if (view === 'documents') await renderDocuments();
    else if (view === 'admin') await renderAdmin();
  } catch (error) { $('#content').innerHTML = `<div class="error-box">${escapeHtml(error.message)}</div>`; }
}

function modal(title, body, actions = '') {
  $('#modalRoot').innerHTML = `<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h3>${escapeHtml(title)}</h3><button class="icon-button" data-close-modal>×</button></div>${body}<div class="modal-actions">${actions}</div></div></div>`;
}
function closeModal() { $('#modalRoot').innerHTML = ''; }

function openSectionNoteEditor(key) {
  const [pageKey, sectionKey] = key.split('|');
  const item = state.contents.find(
    (candidate) =>
      candidate.pageKey === pageKey &&
      candidate.sectionKey === sectionKey,
  );
  if (!item) return;

  const note = state.notes.find(
    (candidate) =>
      candidate.pageKey === pageKey &&
      candidate.sectionKey === sectionKey,
  );

  modal(
    '파트 메모',
    `<form id="sectionNoteForm"><input type="hidden" name="pageKey" value="${escapeHtml(pageKey)}"><input type="hidden" name="sectionKey" value="${escapeHtml(sectionKey)}"><div class="section-note-context"><span>${escapeHtml(pageKey.toUpperCase())}</span><strong>${escapeHtml(item.title)}</strong></div><div class="field"><label>아이디어·수정 의견</label><textarea name="noteText" maxlength="5000" required placeholder="이 파트에서 추가하거나 수정할 아이디어를 작성하세요.">${escapeHtml(note?.noteText || '')}</textarea></div><p class="small muted">작성한 메모는 관리자 화면의 ‘파트별 메모’에서 확인할 수 있습니다.</p></form>`,
    '<button class="ghost" data-close-modal>취소</button><button class="primary" data-save-section-note>메모 저장</button>',
  );
  $('#sectionNoteForm textarea')?.focus();
}

function updateSectionNoteButton(note) {
  const key = `${note.pageKey}|${note.sectionKey}`;
  const button = $$('[data-section-note]').find(
    (candidate) => candidate.dataset.sectionNote === key,
  );
  if (!button) return;
  button.textContent = '메모 있음';
  button.classList.add('note-has-content');
}

function openContentEditor(key) {
  const [pageKey, sectionKey] = key.split('|');
  const item = state.contents.find((x) => x.pageKey === pageKey && x.sectionKey === sectionKey);
  modal('내용 수정', `<form id="contentEditForm"><input type="hidden" name="pageKey" value="${escapeHtml(pageKey)}"><input type="hidden" name="sectionKey" value="${escapeHtml(sectionKey)}"><div class="field"><label>제목</label><input name="title" value="${escapeHtml(item.title)}" required></div><div class="field"><label>본문 · Markdown</label><textarea name="bodyMarkdown" required>${escapeHtml(item.bodyMarkdown)}</textarea></div><div class="field"><label>정렬</label><input name="sortOrder" type="number" value="${item.sortOrder}"></div></form>`, '<button class="ghost" data-close-modal>취소</button><button class="primary" data-save-content>저장</button>');
}

function openCreateAccountEditor() {
  modal(
    '신규 유저 추가',
    `<form id="accountCreateForm"><div class="field"><label>계정명</label><input name="username" minlength="3" maxlength="32" pattern="[a-z0-9][a-z0-9._-]{2,31}" autocomplete="off" placeholder="영문 소문자·숫자·점·밑줄·하이픈" required></div><div class="field"><label>표시명</label><input name="displayName" maxlength="50" required></div><div class="field"><label>초기 비밀번호</label><input type="password" name="password" minlength="10" autocomplete="new-password" required></div><div class="field"><label>초기 비밀번호 확인</label><input type="password" name="confirm" minlength="10" autocomplete="new-password" required></div><div class="field"><label>상태</label><select name="status"><option value="active" selected>active · 즉시 로그인 허용</option><option value="pending">pending · 로그인 대기</option></select></div><div class="field"><label>새 기기 초과 시</label><select name="devicePolicy"><option value="BLOCK" selected>BLOCK · 로그인 차단</option><option value="REPLACE">REPLACE · 기존기기 해제 후 허용</option><option value="ALLOW">ALLOW · 제한 초과 허용</option></select></div><div class="field"><label>PC 제한</label><input type="number" name="pcLimit" min="0" max="10" value="1"></div><div class="field"><label>모바일 제한</label><input type="number" name="mobileLimit" min="0" max="10" value="1"></div><div class="success-box">신규 계정은 게스트로 생성되며, 공개 범위를 지정하기 전까지 모든 메뉴가 비공개입니다.</div></form>`,
    '<button class="ghost" data-close-modal>취소</button><button class="primary" data-save-new-account>계정 생성</button>',
  );
  $('#accountCreateForm input[name="username"]')?.focus();
}

function openAccountEditor(username) {
  const a = state.admin.accounts.find((x) => x.username === username);
  modal(`${username} 계정 설정`, `<form id="accountEditForm"><input type="hidden" name="username" value="${escapeHtml(username)}"><div class="field"><label>표시명</label><input name="displayName" value="${escapeHtml(a.displayName)}"></div><div class="field"><label>상태</label><select name="status"><option value="active" ${a.status==='active'?'selected':''}>active</option><option value="pending" ${a.status==='pending'?'selected':''}>pending</option><option value="disabled" ${a.status==='disabled'?'selected':''}>disabled</option></select></div><div class="field"><label>새 기기 초과 시</label><select name="devicePolicy"><option value="BLOCK" ${a.devicePolicy==='BLOCK'?'selected':''}>BLOCK · 로그인 차단</option><option value="REPLACE" ${a.devicePolicy==='REPLACE'?'selected':''}>REPLACE · 기존기기 해제 후 허용</option><option value="ALLOW" ${a.devicePolicy==='ALLOW'?'selected':''}>ALLOW · 제한 초과 허용</option></select></div><div class="field"><label>PC 제한</label><input type="number" name="pcLimit" min="0" max="10" value="${a.pcLimit}"></div><div class="field"><label>모바일 제한</label><input type="number" name="mobileLimit" min="0" max="10" value="${a.mobileLimit}"></div></form>`, '<button class="ghost" data-close-modal>취소</button><button class="primary" data-save-account>저장</button>');
}

function openPasswordEditor(username) {
  modal(`${username} 비밀번호 설정`, `<form id="passwordEditForm"><input type="hidden" name="username" value="${escapeHtml(username)}"><div class="field"><label>새 비밀번호</label><input type="password" name="password" minlength="10" required></div><div class="field"><label>새 비밀번호 확인</label><input type="password" name="confirm" minlength="10" required></div></form>`, '<button class="ghost" data-close-modal>취소</button><button class="primary" data-save-password>변경</button>');
}

async function openPermissionsEditor(username) {
  const data = await api(`/api/admin/permissions?username=${encodeURIComponent(username)}`);
  state.admin.permissionEditor = data;
  const allowed = new Set(data.allowed || []);

  const groups = (data.groups || []).map((group) => {
    const items = group.items.map((item) => `<label class="permission-item"><input type="checkbox" name="permission" value="${escapeHtml(item.id)}" ${item.parentId ? `data-parent-id="${escapeHtml(item.parentId)}"` : ''} ${allowed.has(item.id) ? 'checked' : ''}><span><strong>${escapeHtml(item.label)}</strong>${item.description ? `<small>${escapeHtml(item.description)}</small>` : ''}</span></label>`).join('');
    return `<section class="permission-group"><div class="permission-group-head"><h4>${escapeHtml(group.label)}</h4><button type="button" class="ghost permission-group-toggle" data-permission-group="${escapeHtml(group.key)}">그룹 전환</button></div><div class="permission-list" data-permission-group-list="${escapeHtml(group.key)}">${items}</div></section>`;
  }).join('');

  const legacyNotice = data.initialized
    ? '<div class="success-box">저장된 공개 범위를 적용 중입니다. 새로 추가되는 콘텐츠는 기본 비공개입니다.</div>'
    : '<div class="error-box">이 계정은 아직 공개 범위를 저장하지 않아 기존처럼 전체 공개 상태입니다. 저장하는 순간부터 선택된 항목만 공개됩니다.</div>';

  modal(
    `${data.displayName || username} 공개 범위`,
    `<form id="permissionsForm" class="permission-editor"><input type="hidden" name="username" value="${escapeHtml(username)}">${legacyNotice}<div class="permission-toolbar"><button type="button" class="secondary" data-permission-action="all">전체 선택</button><button type="button" class="ghost" data-permission-action="none">전체 해제</button></div>${groups}</form>`,
    '<button class="ghost" data-close-modal>취소</button><button class="primary" data-save-permissions>공개 범위 저장</button>',
  );
  $('.modal')?.classList.add('modal-wide');
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
    state.me = data.user; state.csrf = data.csrf; await loadAccess(); showApp(); const initialView = firstAllowedView() || (state.me.role === 'admin' ? 'admin' : null); if (initialView) await navigate(initialView); else showNoAccessiblePage();
  } catch (error) { msg.innerHTML = `<div class="error-box">${escapeHtml(error.message)}</div>`; }
});

$('#bootstrapOpen').addEventListener('click', bootstrapModal);
$('#logoutButton').addEventListener('click', async () => { try { await api('/api/logout', {method:'POST'}); } finally { showLogin(); } });

window.addEventListener('change', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.name !== 'permission') return;

  const form = input.closest('#permissionsForm');
  if (!form) return;

  if (input.checked) {
    let parentId = input.dataset.parentId;
    while (parentId) {
      const parent = [...form.querySelectorAll('input[name="permission"]')]
        .find((candidate) => candidate.value === parentId);
      if (!parent) break;
      parent.checked = true;
      parentId = parent.dataset.parentId;
    }
    return;
  }

  const uncheckChildren = (parentId) => {
    [...form.querySelectorAll('input[name="permission"]')]
      .filter((candidate) => candidate.dataset.parentId === parentId)
      .forEach((child) => {
        child.checked = false;
        uncheckChildren(child.value);
      });
  };

  uncheckChildren(input.value);
});

window.addEventListener('click', async (event) => {
  const target = event.target.closest('button,a'); if (!target) return;
  if (target.dataset.view) { event.preventDefault(); return navigate(target.dataset.view); }
  if (target.dataset.version) { state.version = target.dataset.version; return renderPlans(); }
  if (target.dataset.architectureNode) return activateArchitectureNode(target.dataset.architectureNode);
  if (target.dataset.closeModal !== undefined) return closeModal();
  if (target.dataset.editContent) return openContentEditor(target.dataset.editContent);
  if (target.dataset.sectionNote) return openSectionNoteEditor(target.dataset.sectionNote);
  if (target.dataset.createAccount !== undefined) return openCreateAccountEditor();
  if (target.dataset.accountEdit) return openAccountEditor(target.dataset.accountEdit);
  if (target.dataset.accountPassword) return openPasswordEditor(target.dataset.accountPassword);
  if (target.dataset.accountPermissions) return openPermissionsEditor(target.dataset.accountPermissions);
  if (target.dataset.editDocument) return openDocumentEditor(target.dataset.editDocument);
  if (target.dataset.permissionAction) {
    const checked = target.dataset.permissionAction === 'all';
    $$('#permissionsForm input[name="permission"]').forEach((input) => { input.checked = checked; });
    return;
  }
  if (target.dataset.permissionGroup) {
    const group = target.dataset.permissionGroup;
    const inputs = $$(`[data-permission-group-list="${CSS.escape(group)}"] input[name="permission"]`);
    const shouldCheck = inputs.some((input) => !input.checked);
    inputs.forEach((input) => { input.checked = shouldCheck; });
    return;
  }
  if (target.id === 'initializeContent') {
    if (!confirm('기본 내용을 Google Sheets Content 탭에 초기화합니다. 기존 동일 섹션은 유지됩니다.')) return;
    await api('/api/admin/initialize-content', { method:'POST', body:'{}' }); state.contents=[]; toast('기본 내용이 초기화되었습니다.'); return renderPlans();
  }
  if (target.dataset.saveSectionNote !== undefined) {
    const payload = Object.fromEntries(new FormData($('#sectionNoteForm')));
    const data = await api('/api/notes', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    const saved = data.item;
    const index = state.notes.findIndex(
      (note) =>
        note.pageKey === saved.pageKey &&
        note.sectionKey === saved.sectionKey,
    );
    if (index >= 0) state.notes[index] = saved;
    else state.notes.push(saved);
    closeModal();
    updateSectionNoteButton(saved);
    toast('파트 메모를 저장했습니다.');
    return;
  }
  if (target.dataset.saveContent !== undefined) {
    const form = new FormData($('#contentEditForm'));
    await api('/api/content', {method:'PUT', body:JSON.stringify(Object.fromEntries(form))}); closeModal(); state.contents=[]; toast('내용을 저장했습니다.'); return renderPlans();
  }
  if (target.dataset.saveNewAccount !== undefined) {
    const form = $('#accountCreateForm');
    if (!form.reportValidity()) return;
    const payload = Object.fromEntries(new FormData(form));
    if (payload.password !== payload.confirm) return alert('비밀번호가 일치하지 않습니다.');
    payload.username = String(payload.username || '').trim().toLowerCase();
    payload.pcLimit = Number(payload.pcLimit);
    payload.mobileLimit = Number(payload.mobileLimit);
    delete payload.confirm;
    try {
      const data = await api('/api/admin/accounts', { method: 'POST', body: JSON.stringify(payload) });
      closeModal();
      toast('신규 유저를 생성했습니다. 공개 범위를 지정하세요.');
      await renderAdmin();
      return openPermissionsEditor(data.item.username);
    } catch (error) {
      alert(error.message);
      return;
    }
  }
  if (target.dataset.saveAccount !== undefined) {
    const payload=Object.fromEntries(new FormData($('#accountEditForm'))); payload.pcLimit=Number(payload.pcLimit); payload.mobileLimit=Number(payload.mobileLimit);
    try {
      await api('/api/admin/accounts',{method:'PUT',body:JSON.stringify(payload)}); closeModal(); toast('계정 설정을 저장했습니다.'); return renderAdmin();
    } catch (error) {
      alert(error.message);
      return;
    }
  }
  if (target.dataset.savePassword !== undefined) {
    const form = $('#passwordEditForm');
    if (!form.reportValidity()) return;
    const payload=Object.fromEntries(new FormData(form)); if(payload.password!==payload.confirm) return alert('비밀번호가 일치하지 않습니다.');
    try {
      await api('/api/admin/accounts',{method:'PUT',body:JSON.stringify({username:payload.username,password:payload.password,status:'active'})}); closeModal(); toast('비밀번호를 설정했습니다.'); return renderAdmin();
    } catch (error) {
      alert(error.message);
      return;
    }
  }
  if (target.dataset.savePermissions !== undefined) {
    const form = $('#permissionsForm');
    const username = form.querySelector('input[name="username"]').value;
    const allowed = $$('input[name="permission"]:checked', form).map((input) => input.value);
    await api('/api/admin/permissions', { method: 'PUT', body: JSON.stringify({ username, allowed }) });
    closeModal();
    toast('계정별 공개 범위를 저장했습니다.');
    return renderAdmin();
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
    const data = await api('/api/me'); state.me = data.user; state.csrf = data.csrf; await loadAccess(); showApp(); const initialView = firstAllowedView() || (state.me.role === 'admin' ? 'admin' : null); if (initialView) await navigate(initialView); else showNoAccessiblePage();
  } catch { showLogin(); }
})();
