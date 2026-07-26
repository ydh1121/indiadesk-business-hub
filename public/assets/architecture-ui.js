import { renderMarkdownSafe, escapeHtml } from './markdown.js';

const OVERVIEW_KEY = '__architecture_overview__';

let currentItems = [];
let currentSelectedKey = OVERVIEW_KEY;
let expandedKeys = new Set();
let delegationBound = false;

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

function normalizedText(value = '') {
  return String(value)
    .replace(/\*\*/g, '')
    .replace(/^>\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function summaryText(markdown = '') {
  const lines = String(markdown)
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'))
    .filter((line) => !line.startsWith('>'))
    .filter((line) => !line.startsWith('|'))
    .filter((line) => !/^[-*]\s+/.test(line))
    .filter((line) => !/^\d+\.\s+/.test(line))
    .filter((line) => !/^\*\*[^*]+\*\*$/.test(line));

  return normalizedText(lines[0] || '선택한 구조의 역할과 실행 흐름을 확인합니다.');
}

function stripLeadingSummary(markdown = '', summary = '') {
  const lines = String(markdown)
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split('\n');

  const firstContentIndex = lines.findIndex((line) => line.trim());
  if (firstContentIndex < 0) return '';

  const firstLine = normalizedText(lines[firstContentIndex]);
  if (firstLine !== normalizedText(summary)) return lines.join('\n');

  lines.splice(firstContentIndex, 1);
  while (lines[firstContentIndex] !== undefined && !lines[firstContentIndex].trim()) {
    lines.splice(firstContentIndex, 1);
  }

  return lines.join('\n').trim();
}

function rootKeyFor(key = '') {
  return String(key).split('/')[0];
}

function ancestorKeys(key = '') {
  const keys = [];
  let current = parentKeyOf(key);

  while (current) {
    keys.unshift(current);
    current = parentKeyOf(current);
  }

  return keys;
}

function childCount(key) {
  return currentItems.filter((item) => item.parentKey === key).length;
}

function rootNode(item, hasChildren, isExpanded) {
  const active = currentSelectedKey === item.key;

  return `
    <div class="architecture-phase-head ${active ? 'active' : ''}">
      <button
        type="button"
        class="architecture-root-node"
        data-architecture-node="${escapeHtml(item.key)}"
        aria-selected="${active ? 'true' : 'false'}"
      >
        <span class="architecture-root-number">${escapeHtml(item.number || '·')}</span>
        <span class="architecture-root-copy">
          <strong>${escapeHtml(item.title)}</strong>
          <small>${hasChildren ? `${childCount(item.key)}개 세부 구조` : '단일 구조'}</small>
        </span>
      </button>

      ${hasChildren ? `
        <button
          type="button"
          class="architecture-phase-toggle"
          data-architecture-toggle="${escapeHtml(item.key)}"
          data-expanded="${isExpanded ? 'true' : 'false'}"
          aria-expanded="${isExpanded ? 'true' : 'false'}"
          aria-label="${escapeHtml(item.title)} 하위 구조 ${isExpanded ? '접기' : '펼치기'}"
        >
          <span>⌄</span>
        </button>
      ` : ''}
    </div>
  `;
}

function childNode(item, depth) {
  const active = currentSelectedKey === item.key;

  return `
    <button
      type="button"
      class="architecture-child-node ${active ? 'active' : ''}"
      data-architecture-node="${escapeHtml(item.key)}"
      data-depth="${depth}"
      aria-selected="${active ? 'true' : 'false'}"
    >
      <span class="architecture-child-dot" aria-hidden="true"></span>
      <span class="architecture-child-number">${escapeHtml(item.number || '·')}</span>
      <strong>${escapeHtml(item.title)}</strong>
      <span class="architecture-child-arrow" aria-hidden="true">→</span>
    </button>
  `;
}

function renderNestedChildren(parentKey, map, depth = 1) {
  const children = map.get(parentKey) || [];
  if (!children.length) return '';

  return `
    <ul class="architecture-child-tree" data-depth="${depth}">
      ${children.map((item) => `
        <li>
          ${childNode(item, depth)}
          ${renderNestedChildren(item.key, map, depth + 1)}
        </li>
      `).join('')}
    </ul>
  `;
}

function renderPhase(item, map) {
  const children = map.get(item.key) || [];
  const hasChildren = children.length > 0;
  const isExpanded = expandedKeys.has(item.key);

  return `
    <section class="architecture-phase ${currentSelectedKey === item.key ? 'active' : ''}">
      ${rootNode(item, hasChildren, isExpanded)}
      ${hasChildren && isExpanded ? `
        <div class="architecture-phase-children">
          ${renderNestedChildren(item.key, map)}
        </div>
      ` : ''}
    </section>
  `;
}

function renderTreeHtml() {
  const map = childrenMap(currentItems);
  const roots = map.get('') || [];

  return roots.map((item) => renderPhase(item, map)).join('');
}

function pathItems(item, items) {
  const map = itemMap(items);
  const path = [];
  let current = item;

  while (current) {
    path.unshift(current);
    current = current.parentKey ? map.get(current.parentKey) : null;
  }

  return path;
}

function detailHeader({
  kicker,
  title,
  summary,
  badge,
  number = '',
}) {
  return `
    <header class="architecture-detail-head">
      <div class="architecture-detail-heading">
        <div class="architecture-detail-kicker">${escapeHtml(kicker)}</div>
        <h2>${escapeHtml(title)}</h2>
        ${summary ? `<p>${escapeHtml(summary)}</p>` : ''}
      </div>
      <div class="architecture-detail-mark">
        ${number ? `<span class="architecture-detail-number">${escapeHtml(number)}</span>` : ''}
        <span class="architecture-detail-badge">${escapeHtml(badge)}</span>
      </div>
    </header>
  `;
}

function overviewDetail(items) {
  const roots = childrenMap(items).get('') || [];

  return `
    ${detailHeader({
      kicker: '사업 운영 전체 흐름',
      title: '인도진출 통합사업 운영 구조',
      summary: '기업 유입부터 파트너 교육, 시장검증, 현지 실행, 거래와 반복수익까지 한 흐름으로 연결합니다.',
      badge: '전체 구조',
    })}

    <div class="architecture-overview-body">
      <div class="architecture-overview-intro">
        <span>운영 흐름</span>
        <p>각 단계는 독립된 메뉴가 아니라 앞 단계의 결과가 다음 단계의 실행조건이 되는 연속 구조입니다.</p>
      </div>

      <ol class="architecture-roadmap">
        ${roots.map((item, index) => `
          <li>
            <button
              type="button"
              class="architecture-roadmap-card"
              data-architecture-node="${escapeHtml(item.key)}"
            >
              <span class="architecture-roadmap-number">${escapeHtml(item.number || String(index + 1).padStart(2, '0'))}</span>
              <span class="architecture-roadmap-copy">
                <strong>${escapeHtml(item.title)}</strong>
                <small>${escapeHtml(summaryText(item.description))}</small>
              </span>
              <span class="architecture-roadmap-arrow" aria-hidden="true">→</span>
            </button>
          </li>
        `).join('')}
      </ol>
    </div>

    ${readerNavigation(OVERVIEW_KEY)}
  `;
}

function itemDetail(item, items) {
  const map = itemMap(items);
  const childItems = items
    .filter((candidate) => candidate.parentKey === item.key)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'ko'));

  const parent = item.parentKey ? map.get(item.parentKey) : null;
  const summary = summaryText(item.description);
  const bodyMarkdown = stripLeadingSummary(item.description, summary);
  const path = pathItems(item, items);

  return `
    ${detailHeader({
      kicker: item.parentKey ? '세부 실행 구조' : '핵심 사업 단계',
      title: item.title,
      summary,
      badge: item.parentKey ? '세부 구조' : '핵심 단계',
      number: item.number,
    })}

    <div class="architecture-breadcrumb" aria-label="현재 위치">
      ${path.map((pathItem, index) => `
        ${index ? '<span class="architecture-breadcrumb-separator">/</span>' : ''}
        <button
          type="button"
          data-architecture-node="${escapeHtml(pathItem.key)}"
          ${pathItem.key === item.key ? 'aria-current="page"' : ''}
        >${escapeHtml(pathItem.title)}</button>
      `).join('')}
    </div>

    ${bodyMarkdown ? `
      <div class="architecture-detail-body">
        ${renderMarkdownSafe(bodyMarkdown)}
      </div>
    ` : ''}

    ${parent ? `
      <button
        type="button"
        class="architecture-parent-link"
        data-architecture-node="${escapeHtml(parent.key)}"
      >
        <span class="architecture-parent-link-label">상위 단계</span>
        <strong>${escapeHtml(parent.number)} · ${escapeHtml(parent.title)}</strong>
        <span aria-hidden="true">↑</span>
      </button>
    ` : ''}

    ${childItems.length ? `
      <section class="architecture-child-section">
        <div class="architecture-child-section-head">
          <div>
            <span>다음으로 확인할 구조</span>
            <h3>하위 구성</h3>
          </div>
          <small>${childItems.length}개 항목</small>
        </div>

        <div class="architecture-child-grid">
          ${childItems.map((child) => `
            <button
              type="button"
              class="architecture-child-card"
              data-architecture-node="${escapeHtml(child.key)}"
            >
              <span class="architecture-child-card-number">${escapeHtml(child.number)}</span>
              <span class="architecture-child-card-copy">
                <strong>${escapeHtml(child.title)}</strong>
                <small>${escapeHtml(summaryText(child.description))}</small>
              </span>
              <span class="architecture-child-card-arrow" aria-hidden="true">→</span>
            </button>
          `).join('')}
        </div>
      </section>
    ` : ''}
  `;
}


function linearItems() {
  return [...currentItems].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'ko'),
  );
}

function adjacentItems(key) {
  const items = linearItems();

  if (key === OVERVIEW_KEY) {
    return {
      previous: null,
      next: items[0] || null,
      index: 0,
      total: items.length,
    };
  }

  const index = items.findIndex((item) => item.key === key);

  return {
    previous: index > 0 ? items[index - 1] : null,
    next: index >= 0 && index < items.length - 1 ? items[index + 1] : null,
    index: index >= 0 ? index + 1 : 0,
    total: items.length,
  };
}

function readerButton(item, direction) {
  const disabled = !item;
  const label = direction === 'previous' ? '이전 구조' : '다음 구조';
  const arrow = direction === 'previous' ? '←' : '→';

  return `
    <button
      type="button"
      class="architecture-reader-button ${direction}"
      ${disabled ? 'disabled' : `data-architecture-node="${escapeHtml(item.key)}"`}
    >
      <span class="architecture-reader-arrow" aria-hidden="true">${arrow}</span>
      <span class="architecture-reader-copy">
        <small>${label}</small>
        <strong>${disabled ? '없음' : escapeHtml(item.title)}</strong>
      </span>
    </button>
  `;
}

function readerNavigation(key) {
  const adjacent = adjacentItems(key);

  return `
    <nav class="architecture-reader-nav" aria-label="이전 구조와 다음 구조">
      ${readerButton(adjacent.previous, 'previous')}

      <div class="architecture-reader-progress" aria-label="현재 구조 순서">
        <strong>${adjacent.index}</strong>
        <span>/</span>
        <small>${adjacent.total}</small>
      </div>

      ${readerButton(adjacent.next, 'next')}
    </nav>
  `;
}

function detailHtml(key) {
  if (key === OVERVIEW_KEY) return overviewDetail(currentItems);
  const item = currentItems.find((candidate) => candidate.key === key);
  return item ? itemDetail(item, currentItems) : overviewDetail(currentItems);
}

function refreshTree() {
  const tree = document.querySelector('#architectureTreeNav');
  if (!tree) return;

  const previousScroll = tree.scrollTop;
  tree.innerHTML = renderTreeHtml();
  tree.scrollTop = previousScroll;

  const overviewButton = document.querySelector('[data-architecture-node="__architecture_overview__"]');
  overviewButton?.classList.toggle('active', currentSelectedKey === OVERVIEW_KEY);
}

function bindDelegation() {
  if (delegationBound) return;
  delegationBound = true;

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-architecture-toggle]');
    if (!toggle) return;

    event.preventDefault();
    event.stopPropagation();

    const key = toggle.dataset.architectureToggle;
    if (!key) return;

    if (expandedKeys.has(key)) expandedKeys.delete(key);
    else expandedKeys.add(key);

    refreshTree();
  });
}

export function renderArchitectureWorkspace(items = [], heroHtml = '') {
  currentItems = normalizedItems(items);
  bindDelegation();

  if (!currentItems.some((item) => item.key === currentSelectedKey)) {
    currentSelectedKey = OVERVIEW_KEY;
  }

  if (!currentItems.length) {
    return `${heroHtml}<div class="empty-state">현재 계정에 공개된 통합 아키텍처 단계가 없습니다.</div>`;
  }

  const map = childrenMap(currentItems);
  const roots = map.get('') || [];

  if (!expandedKeys.size && roots[0]) {
    expandedKeys.add(roots[0].key);
  }

  return `
    ${heroHtml}

    <div class="page-toolbar architecture-page-toolbar">
      <div>
        <h2>통합 아키텍처</h2>
        <p class="muted">단계를 선택하면 역할, 실행 흐름, 참여 주체와 수익 연결을 오른쪽에서 확인할 수 있습니다.</p>
      </div>

      <div class="architecture-toolbar-meta">
        <span>${roots.length}개 핵심 단계</span>
        <span>${currentItems.length}개 공개 구조</span>
      </div>
    </div>

    <section class="architecture-workspace">
      <aside class="architecture-tree-panel">
        <div class="architecture-tree-head">
          <div>
            <span>사업 구조</span>
            <strong>단계별 탐색</strong>
          </div>

          <button
            type="button"
            class="architecture-overview-button ${currentSelectedKey === OVERVIEW_KEY ? 'active' : ''}"
            data-architecture-node="${OVERVIEW_KEY}"
          >전체 흐름</button>
        </div>

        <nav
          id="architectureTreeNav"
          class="architecture-tree"
          aria-label="통합 아키텍처 계층 구조"
        >
          ${renderTreeHtml()}
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

  if (key !== OVERVIEW_KEY) {
    const rootKey = rootKeyFor(key);
    expandedKeys.add(rootKey);

    for (const ancestorKey of ancestorKeys(key)) {
      expandedKeys.add(ancestorKey);
    }
  }

  refreshTree();

  const detail = document.querySelector('#architectureDetail');
  if (detail) detail.innerHTML = detailHtml(key);

  if (window.matchMedia('(max-width: 980px)').matches && detail) {
    const topbar = document.querySelector('.topbar');
    const offset = (topbar?.getBoundingClientRect().height || 0) + 10;
    const top = window.scrollY + detail.getBoundingClientRect().top - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
  }
}
