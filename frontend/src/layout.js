export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const labels = { home: '오늘', words: '단어장', mistakes: '오답 단어장', import: '가져오기', stats: '기록', settings: '설정' };
const icons = { home: '⌂', words: 'Aa', mistakes: '!', import: '↥', stats: '↗', settings: '⚙' };
const shortLabels = { ...labels, mistakes: '오답', import: '추가' };
export function isInitialDataLoading(user, status, state) {
  return Boolean(user && status.kind === 'loading' && !state.words.length && !state.sessions.length && !state.imports.length);
}
export function renderLoadingPanel(message = '학습 데이터를 불러오고 있어요') {
  return `<section class="panel data-loading" role="status" aria-live="polite"><span class="sync-spinner sync-spinner-large" aria-hidden="true"></span><div><h2>${escapeHtml(message)}</h2><p>잠시만 기다려 주세요.</p></div></section>`;
}
export function renderShell({ app, route, content, user, status, onRoute, onAccount, onRetry, onReload, onImportGuest, canImportGuest }) {
  const nav = Object.keys(labels).map(key => `<button data-route="${key}" data-short-label="${shortLabels[key]}" aria-label="${labels[key]}" class="nav-item ${route === key ? 'active' : ''}" ${route === key ? 'aria-current="page"' : ''}><span aria-hidden="true">${icons[key]}</span><span class="nav-label">${labels[key]}</span></button>`).join('');
  app.innerHTML = `<a class="skip-link" href="#main-content">본문으로 이동</a><aside><div class="brand"><b>W</b><div>WORD<br><span>GARDEN</span></div></div><nav aria-label="주 메뉴">${nav}</nav><p class="aside-note">매일 조금씩,<br>기억은 오래도록.</p></aside><main id="main-content"><div class="account-bar"><div><strong>${user ? escapeHtml(user.email || '내 계정') : '게스트 학습'}</strong><p class="sync-message" role="status" aria-live="polite"><span class="sync-spinner" aria-hidden="true" hidden></span><span class="sync-label"></span></p></div><div class="account-actions"><button class="secondary sync-retry" hidden>저장 재시도</button><button class="secondary sync-reload" hidden>서버 데이터 불러오기</button><button class="secondary account-button">${user ? '로그아웃' : '로그인 / 회원가입'}</button></div></div>${canImportGuest ? '<section class="guest-import"><p>이 기기에 이전 학습 데이터가 있어요. 현재 계정으로 가져올 수 있습니다.</p><button class="secondary" id="import-guest">기기 데이터 가져오기</button></section>' : ''}<div id="page-content" aria-busy="false">${content}</div></main>`;
  app.querySelectorAll('[data-route]').forEach(el => el.addEventListener('click', () => onRoute(el.dataset.route)));
  app.querySelector('.account-button').addEventListener('click', onAccount);
  app.querySelector('.sync-retry').addEventListener('click', onRetry);
  app.querySelector('.sync-reload').addEventListener('click', onReload);
  app.querySelector('#import-guest')?.addEventListener('click', onImportGuest);
  updateSyncStatus(app, status);
}
export function updateSyncStatus(app, status) {
  const el = app.querySelector('.sync-message');
  if (!el) return;
  el.querySelector('.sync-label').textContent = status.message; el.dataset.kind = status.kind;
  el.querySelector('.sync-spinner').hidden = status.kind !== 'loading';
  app.querySelector('#page-content').setAttribute('aria-busy', String(status.kind === 'loading'));
  app.querySelector('.sync-retry').hidden = !['offline', 'error', 'auth'].includes(status.kind);
  app.querySelector('.sync-reload').hidden = status.kind !== 'conflict';
}
