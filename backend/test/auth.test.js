import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticator } from '../src/auth.js';
const id = '11111111-1111-4111-8111-111111111111';
test('missing or forged tokens cannot authenticate; user comes from Auth server', async () => {
  let calls = 0;
  const authenticate = createAuthenticator({ url: 'https://example.supabase.co', publishableKey: 'public', fetchImpl: async (url, options) => {
    calls++; assert.equal(url.pathname, '/auth/v1/user');
    return options.headers.Authorization === 'Bearer valid' ? Response.json({ id }) : Response.json({}, { status: 401 });
  } });
  await assert.rejects(authenticate({ headers: {} }), { status: 401 });
  assert.equal(calls, 0);
  await assert.rejects(authenticate({ headers: { authorization: 'Bearer forged' } }), { status: 401 });
  assert.equal((await authenticate({ headers: { authorization: 'Bearer valid' } })).id, id);
});
test('Auth outage is unavailable, never an authenticated session', async () => {
  const authenticate = createAuthenticator({ url: 'https://example.supabase.co', publishableKey: 'public', fetchImpl: async () => { throw new Error('offline'); } });
  await assert.rejects(authenticate({ headers: { authorization: 'Bearer valid' } }), { status: 503 });
});
