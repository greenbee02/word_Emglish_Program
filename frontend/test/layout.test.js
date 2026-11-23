import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { escapeHtml, renderShell, updateSyncStatus, renderLoadingPanel, isInitialDataLoading } from '../src/layout.js';
test('imported labels and identifiers cannot escape HTML attributes', () => {
  assert.equal(escapeHtml('\" onfocus=\"alert(1)\" <script>\'&'), '&quot; onfocus=&quot;alert(1)&quot; &lt;script&gt;&#39;&amp;');
});

test('initial account loading shows a status panel; cached data and guests keep their normal screen', () => {
  const empty = { words: [], sessions: [], imports: [] };
  const loading = { kind: 'loading', message: '학습 데이터를 불러오는 중입니다.' };
  assert.equal(isInitialDataLoading({ id: 'a' }, loading, empty), true);
  assert.equal(isInitialDataLoading(null, loading, empty), false);
  assert.equal(isInitialDataLoading({ id: 'a' }, { kind: 'saved' }, empty), false);
  assert.equal(isInitialDataLoading({ id: 'a' }, loading, { ...empty, words: [{ english: 'remember' }] }), false);
});

test('loading indicator announces progress and stops on success or a retryable error', async () => {
  const dom = new Window();
  const app = dom.document.createElement('div'); dom.document.body.append(app);
  const options = { app, route: 'home', user: { email: 'learner@example.test' }, onRoute: () => {}, onAccount: () => {}, onRetry: () => {}, onReload: () => {} };
  try {
    renderShell({ ...options, content: renderLoadingPanel(), status: { kind: 'loading', message: '학습 데이터를 불러오는 중입니다.' } });
    assert.equal(app.querySelector('#page-content').getAttribute('aria-busy'), 'true');
    assert.equal(app.querySelector('.sync-message .sync-spinner').hidden, false);
    assert.equal(app.querySelector('.sync-spinner').getAttribute('aria-hidden'), 'true');
    assert.match(app.querySelector('.data-loading[role=status]').textContent, /학습 데이터를 불러오고 있어요/);
    assert.equal(app.querySelector('.sync-retry').hidden, true);
    updateSyncStatus(app, { kind: 'offline', message: '연결을 확인해 주세요.' });
    assert.equal(app.querySelector('.sync-message .sync-spinner').hidden, true);
    assert.equal(app.querySelector('#page-content').getAttribute('aria-busy'), 'false');
    assert.equal(app.querySelector('.sync-retry').hidden, false);
    renderShell({ ...options, content: '<p>내 단어장</p>', status: { kind: 'saved', message: '계정 데이터를 불러왔습니다.' } });
    assert.equal(app.querySelector('.data-loading'), null);
    assert.equal(app.querySelector('.sync-message .sync-spinner').hidden, true);
    assert.equal(app.querySelector('.sync-retry').hidden, true);
  } finally { await dom.happyDOM.abort(); }
});
