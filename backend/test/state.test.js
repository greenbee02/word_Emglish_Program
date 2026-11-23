import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createRequestHandler, parseAllowedOrigins } from '../src/app.js';
import { emptyState, validateState } from '../src/state.js';

test('empty state is accepted', () => {
  assert.deepEqual(validateState(emptyState()), { valid: true });
});

test('invalid state is rejected', () => {
  assert.equal(validateState({ words: [] }).valid, false);
  assert.equal(validateState(null).valid, false);
});

test('allowed origins are parsed from comma-separated values', () => {
  assert.deepEqual(parseAllowedOrigins('https://a.test, https://b.test'), ['https://a.test', 'https://b.test']);
});

test('state API reads and writes application state', async () => {
  let stored = null;
  const handler = createRequestHandler({
    pool: {},
    authenticate: async () => ({ id: '11111111-1111-4111-8111-111111111111' }),
    getState: async () => stored,
    putState: async (_pool, _workspaceId, state) => {
      stored = { state, version: 1, updatedAt: new Date().toISOString() };
      return { version: 1, updatedAt: stored.updatedAt };
    },
  });
  const invoke = async (method, url, body) => {
    const request = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
    Object.assign(request, { method, url, headers: {} });
    let status;
    let responseBody = '';
    const response = {
      setHeader() {},
      writeHead(value) { status = value; },
      end(value = '') { responseBody += value; },
    };
    await handler(request, response);
    return { status, body: JSON.parse(responseBody) };
  };

  const initial = await invoke('GET', '/api/state');
  assert.equal(initial.status, 200);
  assert.equal(initial.body.state, null);

  const state = emptyState();
  const saved = await invoke('PUT', '/api/state', { state, expectedVersion: 0 });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.saved, true);

  const loaded = await invoke('GET', '/api/state');
  assert.deepEqual(loaded.body.state, state);
});
