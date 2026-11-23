import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { PGlite } from '@electric-sql/pglite';
import { createRequestHandler } from '../src/app.js';
import { createAuthenticator } from '../src/auth.js';
import { initializeDatabase, getState, putState } from '../src/database.js';
import { emptyState } from '../src/state.js';

test('PostgreSQL migration, account isolation, atomic conflicts, RLS and HTTP permissions', async () => {
  const db = new PGlite();
  const pool = { query: async (sql, params) => {
    if (sql.trim().startsWith('BEGIN;')) return db.exec(sql);
    const result = await db.query(sql, params);
    return { ...result, rowCount: result.rows.length || result.affectedRows || 0 };
  } };
  try {
    await db.exec("CREATE TABLE app_state (workspace_id TEXT, state JSONB); INSERT INTO app_state VALUES ('default', '{\"words\":[\"legacy\"]}');");
    await initializeDatabase(pool); await initializeDatabase(pool);
    assert.deepEqual((await db.query('SELECT state FROM app_state')).rows[0].state.words, ['legacy']);
    const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222';
    const aState = { ...emptyState(), words: [{ id: 'a-private' }] };
    assert.equal((await putState(pool, a, aState, 0)).version, 1);
    assert.equal(await putState(pool, a, emptyState(), 0), null);
    assert.equal(await getState(pool, b), null);
    const results = await Promise.all([putState(pool, a, aState, 1), putState(pool, a, emptyState(), 1)]);
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal((await getState(pool, a)).version, 2);

    const authenticate = createAuthenticator({ url: 'https://example.supabase.co', publishableKey: 'public', fetchImpl: async (_url, options) => {
      const userId = ({ 'Bearer a': a, 'Bearer b': b })[options.headers.Authorization];
      return userId ? Response.json({ id: userId }) : Response.json({}, { status: 401 });
    } });
    const handler = createRequestHandler({ pool, getState, putState, authenticate, allowedOrigins: ['https://allowed.test'] });
    const invoke = async (method, url, { token, body, origin } = {}) => {
      const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
      Object.assign(req, { method, url, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(origin ? { origin } : {}) } });
      let status, data; const headers = {};
      await handler(req, { setHeader: (k, v) => { headers[k] = v; }, writeHead: n => { status = n; }, end: text => { data = text ? JSON.parse(text) : null; } });
      return { status, data, headers };
    };
    assert.equal((await invoke('GET', '/api/state')).status, 401);
    assert.equal((await invoke('PUT', '/api/state', { token: 'forged', body: { state: emptyState(), expectedVersion: 0 } })).status, 401);
    assert.equal((await invoke('GET', `/api/state?user_id=${a}`, { token: 'b' })).data.state, null);
    assert.equal((await invoke('PUT', '/api/state', { token: 'b', body: { user_id: a, state: emptyState(), expectedVersion: 0 } })).status, 200);
    assert.equal((await getState(pool, a)).version, 2);
    assert.equal((await getState(pool, b)).version, 1);
    assert.equal((await invoke('PUT', '/api/state', { token: 'a', body: { state: aState, expectedVersion: 1 } })).status, 409);
    assert.equal((await invoke('PUT', '/api/state', { token: 'a', body: { state: aState } })).status, 400);
    assert.equal((await invoke('GET', '/api/state', { token: 'a', origin: 'https://evil.test' })).status, 403);
    const preflight = await invoke('OPTIONS', '/api/state', { origin: 'https://allowed.test' });
    assert.equal(preflight.status, 204); assert.match(preflight.headers['Access-Control-Allow-Headers'], /Authorization/);
    await db.exec('CREATE ROLE browser_user; GRANT USAGE ON SCHEMA public TO browser_user; GRANT SELECT, INSERT ON user_state TO browser_user; SET ROLE browser_user;');
    assert.equal((await db.query('SELECT * FROM user_state')).rows.length, 0);
    await assert.rejects(db.query('INSERT INTO user_state (user_id,state) VALUES ($1,$2)', ['33333333-3333-4333-8333-333333333333', '{}']), /row-level security/i);
    await db.exec('RESET ROLE;');
  } finally { await db.close(); }
});
