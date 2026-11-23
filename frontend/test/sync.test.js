import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyncStore } from '../src/sync.js';
const memory = () => { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) }; };
const state = value => ({ words: [value], sessions: [], imports: [], settings: {} });

test('guest stays local; user and guest caches are separate', async () => {
  const storage = memory(); let calls = 0;
  const store = createSyncStore({ storage, apiBase: '/server', fetchImpl: async () => { calls++; } });
  store.save(state('guest')); await store.sync(store.load());
  store.setUser('a'); assert.deepEqual(store.load(), {});
  store.save(state('a')); store.setUser('b'); assert.deepEqual(store.load(), {});
  store.setUser('a'); assert.deepEqual(store.load(), state('a'));
  assert.deepEqual(store.guest(), state('guest')); assert.equal(calls, 0);
});

test('legacy guest data is preserved for import, never automatically displayed when signed out', () => {
  const storage = memory();
  storage.setItem('word-garden-v1', JSON.stringify(state('legacy-private')));
  const store = createSyncStore({ storage });
  store.setUser(null);
  assert.deepEqual(store.load(), {});
  assert.deepEqual(store.guest(), state('legacy-private'));
  assert.deepEqual(JSON.parse(storage.getItem('word-garden-v1')), state('legacy-private'));
});

test('logout opens an empty guest workspace and stays empty after a page reload', () => {
  const storage = memory();
  const store = createSyncStore({ storage });
  store.save(state('guest-before-login'));
  store.setUser('a'); store.save(state('a-private'));
  store.setUser(null);
  assert.deepEqual(store.load(), {});
  assert.deepEqual(store.guest(), state('guest-before-login'));
  assert.equal(store.isDirty(), false);
  const reloaded = createSyncStore({ storage });
  reloaded.setUser(null);
  assert.deepEqual(reloaded.load(), {});
  assert.deepEqual(reloaded.guest(), state('guest-before-login'));
  reloaded.setUser('a');
  assert.deepEqual(reloaded.load(), state('a-private'));
});

test('an expired session on a new page cannot reactivate the pre-login guest workspace', () => {
  const storage = memory();
  const store = createSyncStore({ storage });
  store.save(state('guest-before-login')); store.setUser('a'); store.save(state('a-private'));
  // A new page can start already signed out without seeing the previous page's SIGNED_OUT event.
  const reloaded = createSyncStore({ storage });
  reloaded.setUser(null);
  assert.deepEqual(reloaded.load(), {});
  assert.deepEqual(reloaded.guest(), state('guest-before-login'));
  reloaded.setUser('a'); assert.deepEqual(reloaded.load(), state('a-private'));
});

test('new guest work persists across reloads and each subsequent logout resets the visible workspace', () => {
  const storage = memory();
  const store = createSyncStore({ storage });
  store.setUser('a'); store.setUser(null); store.save(state('fresh-guest'));
  const reloaded = createSyncStore({ storage });
  assert.deepEqual(reloaded.load(), state('fresh-guest'));
  reloaded.setUser('b'); reloaded.save(state('b-private')); reloaded.setUser(null);
  assert.deepEqual(reloaded.load(), {});
  assert.deepEqual(reloaded.guest(), state('fresh-guest'));
  reloaded.setUser('b'); assert.deepEqual(reloaded.load(), state('b-private'));
});

test('logout cancels a pending account write and its response cannot refill the guest workspace', async () => {
  let complete, puts = 0;
  const storage = memory();
  const store = createSyncStore({ storage, apiBase: '/server', getSession: async () => ({ user: { id: 'a' }, access_token: 'token' }), fetchImpl: async (_url, options) => {
    if (options.method === 'GET') return Response.json({ state: state('a-private'), version: 1 });
    puts++;
    return new Promise(resolve => { complete = () => resolve(Response.json({ version: 2 })); });
  } });
  store.setUser('a'); await store.sync({}); store.save(state('a-edit'));
  const saving = store.flush(); await new Promise(resolve => setImmediate(resolve));
  store.setUser(null); complete();
  assert.equal(await saving, false);
  assert.deepEqual(store.load(), {}); assert.equal(await store.flush(), true); assert.equal(puts, 1);
  store.setUser('a'); assert.deepEqual(store.load(), state('a-edit'));
});
test('account switch cancels old requests and never initializes new account with guest data', async () => {
  let release;
  const store = createSyncStore({ storage: memory(), apiBase: '/server', getSession: async () => ({ user: { id: 'a' }, access_token: 'a-token' }), fetchImpl: async () => new Promise(resolve => { release = resolve; }) });
  store.setUser('a'); const loading = store.sync(state('a-local')); await new Promise(resolve => setImmediate(resolve));
  store.setUser('b'); release(Response.json({ state: state('a-secret'), version: 1 }));
  await assert.rejects(loading, { name: 'AbortError' }); assert.deepEqual(store.load(), {});
});
test('concurrent edits are serialized; stale revisions receive conflict without losing local edits', async () => {
  const storage = memory(); let serverVersion = 1, serverState = state('remote'), puts = 0;
  const store = createSyncStore({ storage, apiBase: '/server', getSession: async () => ({ user: { id: 'a' }, access_token: 'token' }), fetchImpl: async (_url, options) => {
    if (options.method === 'GET') return Response.json({ state: serverState, version: serverVersion });
    puts++; const body = JSON.parse(options.body);
    assert.equal(options.headers.Authorization, 'Bearer token');
    if (body.expectedVersion !== serverVersion) return Response.json({ error: 'conflict' }, { status: 409 });
    serverState = body.state; return Response.json({ version: ++serverVersion });
  } });
  store.setUser('a'); assert.deepEqual(await store.sync({}), serverState);
  store.save(state('first')); await store.flush(); assert.equal(serverVersion, 2);
  serverVersion++; store.save(state('offline edit')); assert.equal(await store.flush(), false);
  assert.equal(store.getStatus().kind, 'conflict'); assert.deepEqual(store.load(), state('offline edit'));
  const attempts = puts; store.save(state('newer edit')); await store.flush(); assert.equal(puts, attempts);
  assert.deepEqual(await store.sync(store.load(), { discardLocal: true }), serverState);
  assert.equal(store.isDirty(), false);
});
test('offline edits survive reload and are not overwritten by an outdated server snapshot', async () => {
  const storage = memory(); let offline = true;
  const options = { storage, apiBase: '/server', getSession: async () => ({ user: { id: 'a' }, access_token: 'token' }), fetchImpl: async () => {
    if (offline) throw new Error('offline');
    return Response.json({ state: state('other-device'), version: 2 });
  } };
  const first = createSyncStore(options); first.setUser('a'); first.save(state('unsaved')); await first.sync(first.load());
  const reopened = createSyncStore(options); reopened.setUser('a'); offline = false;
  assert.deepEqual(await reopened.sync(reopened.load()), state('unsaved'));
  assert.equal(reopened.getStatus().kind, 'conflict');
});
test('expired session cannot write and token from a different user is rejected', async () => {
  let session = { user: { id: 'a' }, access_token: 'a-token' }, calls = 0;
  const store = createSyncStore({ storage: memory(), apiBase: '/server', getSession: async () => session, fetchImpl: async () => { calls++; return Response.json({ state: state('a'), version: 1 }); } });
  store.setUser('a'); await store.sync({}); session = { user: { id: 'b' }, access_token: 'b-token' };
  store.save(state('private edit')); assert.equal(await store.flush(), false); assert.equal(calls, 1);
  assert.equal(store.getStatus().kind, 'auth'); assert.equal(store.isDirty(), true);
});

test('saving while an earlier write is in flight sends the latest edit with the new version', async () => {
  let release, puts = 0; const writes = [];
  const store = createSyncStore({ storage: memory(), apiBase: '/server', getSession: async () => ({ user: { id: 'a' }, access_token: 'token' }), fetchImpl: async (_url, options) => {
    if (options.method === 'GET') return Response.json({ state: state('initial'), version: 1 });
    const body = JSON.parse(options.body); writes.push(body); puts++;
    if (puts === 1) return new Promise(resolve => { release = () => resolve(Response.json({ version: 2 })); });
    return Response.json({ version: 3 });
  } });
  store.setUser('a'); await store.sync({}); store.save(state('first'));
  const saving = store.flush(); await new Promise(resolve => setImmediate(resolve));
  store.save(state('latest')); release(); assert.equal(await saving, true);
  assert.deepEqual(writes.map(w => w.expectedVersion), [1, 2]);
  assert.deepEqual(writes[1].state, state('latest')); assert.equal(store.isDirty(), false);
});

test('logout reports cached unsaved edits when initial server loading failed', async () => {
  const storage = memory(); const options = { storage, apiBase: '/server', getSession: async () => ({ user: { id: 'a' }, access_token: 'token' }), fetchImpl: async () => { throw new Error('offline'); } };
  const first = createSyncStore(options); first.setUser('a'); first.save(state('offline'));
  const reopened = createSyncStore(options); reopened.setUser('a'); await reopened.sync(reopened.load());
  assert.equal(await reopened.flush(), false); assert.equal(reopened.isDirty(), true);
});

test('each server reload reports loading until completion and stops loading on failure', async () => {
  let calls = 0, complete;
  const store = createSyncStore({ storage: memory(), apiBase: '/server', getSession: async () => ({ user: { id: 'a' }, access_token: 'token' }), fetchImpl: async () => {
    calls++;
    if (calls === 1) return Response.json({ state: state('remote'), version: 1 });
    if (calls === 2) return new Promise(resolve => { complete = () => resolve(Response.json({ state: state('updated'), version: 2 })); });
    throw new Error('offline');
  } });
  store.setUser('a'); await store.sync({}); assert.equal(store.getStatus().kind, 'saved');
  const loading = store.sync(store.load());
  assert.equal(store.getStatus().kind, 'loading');
  await new Promise(resolve => setImmediate(resolve));
  complete(); assert.deepEqual(await loading, state('updated'));
  assert.equal(store.getStatus().kind, 'saved');
  await store.sync(store.load()); assert.equal(store.getStatus().kind, 'offline');
});
