import { renderMarkdownSafe, escapeHtml } from './markdown.js';

const OVERVIEW_KEY = '__architecture_overview__';

let currentItems = [];
let currentSelectedKey = OVERVIEW_KEY;

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parentKeyOf(key = '') {
  const normalized = String(key);
  const separator = normalized.lastIndexOf('/');
  return separator > 0 ? normalized.slice(0, separator) : '';
}

function normalizedItems(items = []) {
  return items
    .filter((item) => item && item.key)
    .map((item) => ({
      ...item,
      key: String(item.key),
      number: String(item.number || ''),
      title: String(item.title || item.key),
      description: String(item.description || ''),
      sortOrder: numberValue(item.sortOrder),
      parentKey: parentKeyOf(item.key),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'ko'));
}

function itemMap(items) {
  return new Map(items.map((item) => [item.key, item]));
}

function childrenMap(items) {
  const map = new Map();
  const keys = new Set(items.map((item) => item.key));

  for (const item of items) {
    const parentKey = item.parentKey && keys.has(item.parentKey)
      ? item.parentKey
      : '';

    if (!map.has(parentKey)) map.set(parentKey, []);
    map.get(parentKey).push(item);
  }

  for (const children of map.values()) {
    children.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'ko'));
  }

  return map;
}

function shortSummary(markdown = '') {
  const lines = String(markdown)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'))
    .filter((line) => !line.startsWith('>'))
    .filter((line) => !line.startsWith('|'))
    .filter((line) => !/^[-*]\s+/.test(line));

  return lines[0]?.replace(/\*\*/g, '') || '세부 내용을 선택해 확인합니다.';
}

function nodeButton(item, level) {
  const hasChildren = currentItems.some((candidate) => candidate.parentKey === item.key);
  return `
    <button
      type="button"
      class="architecture-node ${currentSelectedKey === item.key ? 'active' : ''}"
      data-architecture-node="${escapeHtml(item.key)}"
      data-level="${level}"
      aria-selected="${currentSelectedKey === item.key ? 'true' : 'false'}"
    >
      <span class="architecture-node-number">${escapeHtml(item.number || '·')}</span>
      <span class="architecture-node-copy">
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(shortSummary(item.description))}</small>
      </span>
      ${hasChildren ? '<span class="architecture-node-branch">+</span>' : '<span class="architecture-node-leaf">•</span>'}
    </button>
  `;
}

function renderBranch(parentKey, map, level = 0) {
  const children = map.get(parentKey) || [];
  if (!children.length) return '';

  return `
    <ul class="architecture-branch-list" data-depth="${level}">
      ${children.map((item) => `
        <li class="architecture-branch-item">
          ${nodeButton(item, level)}
          ${renderBranch(item.key, map, level + 1)}
        </li>
      `).join('')}
    </ul>
  `;
}

function overviewDetail(items) {
  const roots = childrenMap(items).get('') || [];

  return `
    <div class="architecture-detail-head">
      <div>
        <div class="architecture-detail-kicker">INTEGRATED BUSINESS ARCHITECTURE</div>
        <h2>인도진출 통합사업 운영 구조</h2>
        <p>콘텐츠 유입부터 파트너 교육, 기업 등록, 시장검증, IBS 현지 실행, 양방향 거래와 반복수익까지 하나의 흐름으로 관리합니다.</p>
      </div>
      <span class="architecture-detail-badge">전체 구조</span>
    </div>

    <div class="architecture-overview-grid">
      ${roots.map((item) => `
        <button type="button" class="architecture-overview-card" data-architecture-node="${escapeHtml(item.key)}">
          <span>${escapeHtml(item.number)}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <small>${escapeHtml(shortSummary(item.description))}</small>
        </button>
      `).join('')}
    </div>

    <div class="architecture-detail-body">
      <h3>전체 흐름</h3>
      <ol class="architecture-flow-list">
        ${roots.map((item) => `<li><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(shortSummary(item.description))}</span></li>`).join('')}
      </ol>

      <blockquote>
        각 단계는 Google Sheets의 Architecture 탭에서 관리하며, 계정별 공개 범위에 따라 허용된 노드만 표시됩니다.
      </blockquote>
    </div>
  `;
}

function itemDetail(item, items) {
  const map = itemMap(items);
  const childItems = items
    .filter((candidate) => candidate.parentKey === item.key)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const parent = item.parentKey ? map.get(item.parentKey) : null;
  const levelLabel = item.parentKey ? '세부 구조' : '핵심 사업 단계';

  return `
    <div class="architecture-detail-head">
      <div>
        <div class="architecture-detail-kicker">${escapeHtml(levelLabel)} · ${escapeHtml(item.number || '')}</div>
        <h2>${escapeHtml(item.title)}</h2>
        <p>${escapeHtml(shortSummary(item.description))}</p>
      </div>
      <span class="architecture-detail-badge">${item.parentKey ? 'DETAIL' : 'CORE'}</span>
    </div>

    ${parent ? `
      <button type="button" class="architecture-parent-link" data-architecture-node="${escapeHtml(parent.key)}">
        <span>상위 구조</span>
        <strong>${escapeHtml(parent.number)} · ${escapeHtml(parent.title)}</strong>
      </button>
    ` : ''}

    <div class="architecture-detail-body">
      ${renderMarkdownSafe(item.description)}
    </div>

    ${childItems.length ? `
      <div class="architecture-child-section">
        <h3>하위 구성</h3>
        <div class="architecture-child-grid">
          ${childItems.map((child) => `
            <button type="button" class="architecture-child-card" data-architecture-node="${escapeHtml(child.key)}">
              <span>${escapeHtml(child.number)}</span>
              <strong>${escapeHtml(child.title)}</strong>
              <small>${escapeHtml(shortSummary(child.description))}</small>
            </button>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

function detailHtml(key) {
  if (key === OVERVIEW_KEY) return overviewDetail(currentItems);
  const item = currentItems.find((candidate) => candidate.key === key);
  return item ? itemDetail(item, currentItems) : overviewDetail(currentItems);
}

export function renderArchitectureWorkspace(items = [], heroHtml = '') {
  currentItems = normalizedItems(items);

  if (!currentItems.some((item) => item.key === currentSelectedKey)) {
    currentSelectedKey = OVERVIEW_KEY;
  }

  if (!currentItems.length) {
    return `${heroHtml}<div class="empty-state">현재 계정에 공개된 통합 아키텍처 단계가 없습니다.</div>`;
  }

  const map = childrenMap(currentItems);

  return `
    ${heroHtml}

    <div class="page-toolbar architecture-page-toolbar">
      <div>
        <h2>통합 아키텍처</h2>
        <p class="muted">좌측 트리에서 사업 단계나 세부 구조를 선택하면 우측에서 역할, 진행 흐름, 참여 주체와 수익 연결을 확인할 수 있습니다.</p>
      </div>
      <div class="architecture-toolbar-meta">
        <span>${map.get('')?.length || 0}개 핵심 단계</span>
        <span>${currentItems.length}개 공개 노드</span>
      </div>
    </div>

    <section class="architecture-workspace">
      <aside class="architecture-tree-panel">
        <div class="architecture-tree-head">
          <div>
            <span>BUSINESS TREE</span>
            <strong>사업 구조 탐색</strong>
          </div>
          <button
            type="button"
            class="architecture-overview-button ${currentSelectedKey === OVERVIEW_KEY ? 'active' : ''}"
            data-architecture-node="${OVERVIEW_KEY}"
          >전체 보기</button>
        </div>

        <nav class="architecture-tree" aria-label="통합 아키텍처 계층 구조">
          ${renderBranch('', map)}
        </nav>
      </aside>

      <article id="architectureDetail" class="architecture-detail-panel">
        ${detailHtml(currentSelectedKey)}
      </article>
    </section>
  `;
}

export function activateArchitectureNode(key) {
  if (!key) return;

  if (key !== OVERVIEW_KEY && !currentItems.some((item) => item.key === key)) {
    return;
  }

  currentSelectedKey = key;

  document.querySelectorAll('[data-architecture-node]').forEach((element) => {
    const active = element.dataset.architectureNode === key;
    element.classList.toggle('active', active);
    if (element.classList.contains('architecture-node')) {
      element.setAttribute('aria-selected', active ? 'true' : 'false');
    }
  });

  const detail = document.querySelector('#architectureDetail');
  if (detail) detail.innerHTML = detailHtml(key);

  if (window.matchMedia('(max-width: 980px)').matches && detail) {
    detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
