const PROTECTED_ROOT_SELECTOR = '#app';
const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable="true"], [data-allow-selection]';

let shieldTimer = null;
let watermarkTimer = null;
const securityEventCooldown = new Map();

function protectedRoot() {
  return document.querySelector(PROTECTED_ROOT_SELECTOR);
}

function isProtectedVisible() {
  const root = protectedRoot();
  return Boolean(root && !root.classList.contains('hidden'));
}

function isEditableTarget(target) {
  return target instanceof Element && Boolean(target.closest(EDITABLE_SELECTOR));
}

function currentSecurityContext() {
  const selectedArchitecture = document.querySelector(
    '.architecture-node[aria-selected="true"], [data-architecture-node][aria-current="page"]',
  );

  return {
    view: document.querySelector('#viewTitle')?.textContent?.trim() || '',
    architectureKey: selectedArchitecture?.dataset.architectureNode || '',
    path: `${location.pathname}${location.search}`.slice(0, 300),
    screen: `${screen.width}x${screen.height}`,
    visibility: document.visibilityState,
  };
}

function logSecurityEvent(eventType, reason) {
  if (!isProtectedVisible()) return;

  const now = Date.now();
  const last = securityEventCooldown.get(eventType) || 0;
  if (now - last < 4000) return;
  securityEventCooldown.set(eventType, now);

  const userAgent = navigator.userAgent;
  const category = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)
    ? 'mobile'
    : 'pc';
  let os = 'Unknown';
  if (/Windows/i.test(userAgent)) os = 'Windows';
  else if (/Android/i.test(userAgent)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(userAgent)) os = 'iOS/iPadOS';
  else if (/Mac OS X/i.test(userAgent)) os = 'macOS';
  else if (/Linux/i.test(userAgent)) os = 'Linux';

  let browser = 'Other';
  if (/Edg\//.test(userAgent)) browser = 'Edge';
  else if (/Chrome\//.test(userAgent)) browser = 'Chrome';
  else if (/Safari\//.test(userAgent)) browser = 'Safari';
  else if (/Firefox\//.test(userAgent)) browser = 'Firefox';

  const payload = {
    eventType,
    reason,
    category,
    os,
    browser,
    ...currentSecurityContext(),
  };

  fetch('/api/security-events', {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

function ensureProtectionLayer() {
  let layer = document.querySelector('#contentProtectionLayer');
  if (layer) return layer;

  layer = document.createElement('div');
  layer.id = 'contentProtectionLayer';
  layer.className = 'content-protection-layer';
  layer.setAttribute('aria-hidden', 'true');

  const watermarkGrid = document.createElement('div');
  watermarkGrid.className = 'content-watermark-grid';

  for (let index = 0; index < 15; index += 1) {
    const item = document.createElement('span');
    item.className = 'content-watermark-item';
    watermarkGrid.appendChild(item);
  }

  const shield = document.createElement('div');
  shield.className = 'content-capture-shield';
  shield.innerHTML = `
    <div>
      <strong>보호된 화면</strong>
      <span>화면 전환 또는 캡처 동작이 감지되어 내용을 가렸습니다.</span>
    </div>
  `;

  layer.append(watermarkGrid, shield);
  document.body.appendChild(layer);

  return layer;
}

function watermarkLabel() {
  const session = document.querySelector('#sessionInfo')?.textContent?.trim() || 'AUTHORIZED USER';
  const date = new Date().toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${session} · ${date}`;
}

function updateWatermark() {
  const layer = ensureProtectionLayer();
  const label = watermarkLabel();

  layer.querySelectorAll('.content-watermark-item').forEach((item) => {
    item.textContent = label;
  });

  layer.classList.toggle('content-protection-visible', isProtectedVisible());
}

function activateShield(duration = 1200) {
  if (!isProtectedVisible()) return;

  const layer = ensureProtectionLayer();
  layer.classList.add('content-capture-shield-active');

  window.clearTimeout(shieldTimer);
  if (duration > 0) {
    shieldTimer = window.setTimeout(() => {
      layer.classList.remove('content-capture-shield-active');
    }, duration);
  }
}

function deactivateShield() {
  const layer = ensureProtectionLayer();
  window.clearTimeout(shieldTimer);
  layer.classList.remove('content-capture-shield-active');
}

function preventProtectedAction(event) {
  if (!isProtectedVisible()) return;
  if (!(event.target instanceof Element)) return;
  if (!event.target.closest(PROTECTED_ROOT_SELECTOR)) return;
  if (isEditableTarget(event.target)) return;

  event.preventDefault();
}

function handleKeydown(event) {
  if (!isProtectedVisible()) return;

  if (event.key === 'PrintScreen') {
    event.preventDefault();
    activateShield(1800);
    logSecurityEvent(
      'CAPTURE_PRINTSCREEN',
      'PrintScreen 키 입력이 감지되었습니다. 실제 캡처 저장 여부는 브라우저에서 확인할 수 없습니다.',
    );

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText('Protected content').catch(() => {});
    }
    return;
  }

  const command = event.ctrlKey || event.metaKey;
  if (!command) return;

  const key = event.key.toLowerCase();
  const blocked = ['c', 'x', 's', 'p', 'u'];

  if (!blocked.includes(key)) return;
  if (isEditableTarget(event.target) && ['c', 'x'].includes(key)) return;

  event.preventDefault();
  activateShield(700);

  if (key === 'p') {
    logSecurityEvent('CAPTURE_PRINT', '인쇄 또는 PDF 저장 단축키 입력이 차단되었습니다.');
  } else if (key === 's') {
    logSecurityEvent('CONTENT_SAVE_BLOCKED', '페이지 저장 단축키 입력이 차단되었습니다.');
  } else if (key === 'c' || key === 'x') {
    logSecurityEvent('CONTENT_COPY_BLOCKED', '보호 콘텐츠 복사 또는 잘라내기 입력이 차단되었습니다.');
  }
}

function initializeObservers() {
  const app = protectedRoot();
  const session = document.querySelector('#sessionInfo');

  if (app) {
    new MutationObserver(updateWatermark).observe(app, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  if (session) {
    new MutationObserver(updateWatermark).observe(session, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }
}

function initializeContentProtection() {
  document.documentElement.classList.add('content-protection-enabled');
  ensureProtectionLayer();
  updateWatermark();
  initializeObservers();

  document.addEventListener('dragstart', preventProtectedAction, true);
  document.addEventListener('selectstart', preventProtectedAction, true);
  document.addEventListener('contextmenu', preventProtectedAction, true);
  document.addEventListener('copy', preventProtectedAction, true);
  document.addEventListener('cut', preventProtectedAction, true);
  document.addEventListener('keydown', handleKeydown, true);

  window.addEventListener('blur', () => activateShield(0));
  window.addEventListener('focus', () => window.setTimeout(deactivateShield, 180));

  window.addEventListener('beforeprint', () => {
    activateShield(0);
    logSecurityEvent(
      'CAPTURE_PRINT',
      '브라우저 인쇄 또는 PDF 저장 화면 진입이 감지되었습니다.',
    );
  });
  window.addEventListener('afterprint', deactivateShield);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) activateShield(0);
    else window.setTimeout(deactivateShield, 180);
  });

  watermarkTimer = window.setInterval(updateWatermark, 60_000);
}

initializeContentProtection();

window.addEventListener('beforeunload', () => {
  window.clearInterval(watermarkTimer);
});
