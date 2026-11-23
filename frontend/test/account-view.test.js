import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { showAccount, closeAccount } from '../src/account-view.js';

let dom, previous;
beforeEach(() => {
  previous = { document: globalThis.document, FormData: globalThis.FormData };
  dom = new Window({ url: 'https://test.word-garden.example/' });
  globalThis.document = dom.document;
  globalThis.FormData = dom.FormData;
});
afterEach(async () => {
  closeAccount(); await dom.happyDOM.abort();
  for (const [name, value] of Object.entries(previous)) {
    if (value === undefined) delete globalThis[name]; else globalThis[name] = value;
  }
});
const tick = () => new Promise(resolve => setImmediate(resolve));
function open(mode, client, extra = {}) {
  return showAccount(mode, { client, configured: true, redirect: () => 'https://test.word-garden.example/', ...extra });
}
function fill(dialog, fields) {
  for (const [name, value] of Object.entries(fields)) dialog.querySelector(`[name="${name}"]`).value = value;
}
function submit(dialog) { dialog.querySelector('form').requestSubmit(); }

test('login passes credentials and closes only after success', async () => {
  let received;
  const dialog = open('signin', { signInWithPassword: async value => { received = value; return { data: { session: {} } }; } });
  fill(dialog, { email: 'learner@example.test', password: 'test-password' });
  submit(dialog); await tick();
  assert.deepEqual(received, { email: 'learner@example.test', password: 'test-password' });
  assert.equal(dialog.isConnected, false);
});

test('invalid credentials show an actionable message and permit retry', async () => {
  const dialog = open('signin', { signInWithPassword: async () => ({ error: { code: 'invalid_credentials' } }) });
  fill(dialog, { email: 'learner@example.test', password: 'wrong' }); submit(dialog); await tick();
  assert.equal(dialog.open, true);
  assert.match(dialog.querySelector('[role=status]').textContent, /이메일 또는 비밀번호/);
  assert.equal(dialog.querySelector('[type=submit]').disabled, false);
});

test('signup rejects mismatched confirmation and requests email confirmation with correct redirect', async () => {
  let calls = 0, received;
  const dialog = open('signup', { signUp: async value => { calls++; received = value; return { data: { session: null } }; } });
  fill(dialog, { email: 'learner@example.test', password: 'test-password', confirm: 'different-password' }); submit(dialog); await tick();
  assert.equal(calls, 0); assert.match(dialog.querySelector('[role=status]').textContent, /일치하지/);
  fill(dialog, { confirm: 'test-password' }); submit(dialog); await tick();
  assert.equal(calls, 1);
  assert.equal(received.options.emailRedirectTo, 'https://test.word-garden.example/');
  assert.match(dialog.querySelector('[role=status]').textContent, /인증 메일/);
  assert.equal(dialog.open, true);
  assert.equal(dialog.querySelector('[name=password]').value, '');
});

test('password reset requests a recovery URL and does not ask for an existing password', async () => {
  let received;
  const dialog = open('reset', { resetPasswordForEmail: async (...args) => { received = args; return { data: {} }; } });
  assert.equal(dialog.querySelector('[name=password]'), null);
  fill(dialog, { email: 'learner@example.test' }); submit(dialog); await tick();
  assert.deepEqual(received, ['learner@example.test', { redirectTo: 'https://test.word-garden.example/?recovery=1' }]);
  assert.match(dialog.querySelector('[role=status]').textContent, /재설정 링크/);
});

test('recovery updates the password only after matching confirmation', async () => {
  let received, message;
  const dialog = open('recovery', { updateUser: async value => { received = value; return { data: {} }; } }, { onComplete: text => { message = text; } });
  fill(dialog, { password: 'new-password', confirm: 'new-password' }); submit(dialog); await tick();
  assert.deepEqual(received, { password: 'new-password' });
  assert.equal(message, '비밀번호를 변경했습니다.'); assert.equal(dialog.isConnected, false);
});

test('pending submission cannot be duplicated or replace a newer account dialog', async () => {
  let resolve, calls = 0;
  const dialog = open('signin', { signInWithPassword: async () => { calls++; return new Promise(done => { resolve = done; }); } });
  fill(dialog, { email: 'learner@example.test', password: 'test-password' });
  submit(dialog); submit(dialog);
  assert.equal(calls, 1); assert.equal(dialog.querySelector('[data-mode=signup]').disabled, true);
  closeAccount();
  const nextDialog = open('recovery', {});
  resolve({ data: { session: {} } }); await tick();
  assert.equal(nextDialog.open, true); assert.equal(nextDialog.isConnected, true);
  assert.match(nextDialog.querySelector('h2').textContent, /새 비밀번호/);
});

test('missing auth configuration keeps guests local without showing a working login form', () => {
  const dialog = showAccount('signin', { client: null, configured: false });
  assert.equal(dialog.querySelector('form'), null);
  assert.match(dialog.textContent, /기기 저장 모드/);
});
