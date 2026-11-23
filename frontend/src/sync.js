// Storage and network state live outside the views so account changes can cancel all old work.
export function createSyncStore({ storage, apiBase = '', getSession = async () => null, fetchImpl = fetch, onStatus = () => {} }) {
  const legacyGuestKey = 'word-garden-v1';
  const guestPrefix = 'word-garden-v2:guest:';
  const guestSessionKey = 'word-garden-v2:guest-session';
  const guestImportKey = 'word-garden-v2:guest-import';
  const read = (name, fallback) => { try { return JSON.parse(storage.getItem(name) || 'null') ?? fallback; } catch { return fallback; } };
  const savedGuestSession = read(guestSessionKey, 'initial');
  let guestKey = `${guestPrefix}${typeof savedGuestSession === 'string' && /^[a-zA-Z0-9-]+$/.test(savedGuestSession) ? savedGuestSession : 'initial'}`;
  let userId = null, key = guestKey, generation = 0, controller = new AbortController();
  let timer, pending = null, inFlight = null, version = 0, hydrated = false, blocked = false, revision = 0;
  let status = { kind: 'local', message: '이 기기에 저장됩니다.' };
  const notify = (kind, message) => { status = { kind, message }; onStatus(status); };
  const hasGuestData = value => ['words', 'imports', 'sessions'].some(field => Array.isArray(value?.[field]) && value[field].length > 0);
  const meta = () => read(`${key}:sync`, { version: 0, dirty: false });
  const writeMeta = (dirty) => storage.setItem(`${key}:sync`, JSON.stringify({ version, dirty }));

  function setUser(id) {
    const nextUserId = id || null;
    let guestStorageError = false;
    // Preserve pre-login guest work for explicit import, without opening it on logout.
    if (!userId && nextUserId && hasGuestData(read(guestKey, {}))) {
      try { storage.setItem(guestImportKey, JSON.stringify(guestKey)); }
      catch { guestStorageError = true; }
    }
    if (Boolean(userId) !== Boolean(nextUserId)) {
      // Start the next anonymous workspace at both auth boundaries, including expiry on reload.
      // Old guest data and account caches remain intact for explicit import/re-login.
      const session = crypto.randomUUID();
      guestKey = `${guestPrefix}${session}`;
      try { storage.setItem(guestSessionKey, JSON.stringify(session)); }
      catch { guestStorageError = true; }
    }
    generation++; controller.abort(); controller = new AbortController();
    clearTimeout(timer); pending = null; inFlight = null; revision = 0;
    userId = nextUserId; key = userId ? `word-garden-v2:user:${userId}` : guestKey;
    version = meta().version; hydrated = false; blocked = false;
    notify(userId ? 'loading' : 'local', userId ? '내 데이터를 불러오는 중입니다.' : '이 기기에 저장됩니다. 로그인하면 계정에 저장할 수 있어요.');
    if (guestStorageError) notify('error', '기기의 게스트 저장 설정을 갱신하지 못했습니다. 저장 공간을 확인해 주세요.');
  }
  function load() { return read(key, {}); }
  async function request(method, body, epoch) {
    const session = await getSession();
    if (epoch !== generation) throw new DOMException('Account changed', 'AbortError');
    if (!session?.access_token || session.user?.id !== userId) throw Object.assign(new Error('다시 로그인해 주세요. 이 기기의 데이터는 보관됩니다.'), { status: 401 });
    const response = await fetchImpl(`${apiBase}/api/state`, {
      method, signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (epoch !== generation) throw new DOMException('Account changed', 'AbortError');
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || `저장 서버 오류 (${response.status})`), { status: response.status });
    return data;
  }
  function failure(error) {
    if (error.name === 'AbortError') return;
    if (error.status === 409) blocked = true;
    notify(error.status === 409 ? 'conflict' : error.status === 401 ? 'auth' : 'offline', error.message || '서버 연결을 확인해 주세요. 이 기기에 변경 내용을 보관합니다.');
  }
  function save(state) {
    try { storage.setItem(key, JSON.stringify(state)); writeMeta(true); }
    catch { notify('error', '기기 저장 공간이 부족합니다. 설정에서 백업을 내려받아 주세요.'); return; }
    revision++;
    if (!userId) { notify('local', '이 기기에 저장했습니다.'); return; }
    pending = structuredClone(state);
    if (!apiBase) { notify('offline', '계정 저장 서버가 설정되지 않았습니다. 이 기기에 보관합니다.'); return; }
    if (!hydrated || blocked) return;
    notify('saving', '변경 내용을 저장하고 있습니다.');
    clearTimeout(timer); timer = setTimeout(() => { void flush(); }, 350);
  }
  async function flush() {
    clearTimeout(timer);
    if (inFlight) return inFlight;
    if (!userId) return true;
    if (!pending) return !meta().dirty;
    if (!hydrated || blocked || !apiBase) return false;
    const epoch = generation;
    const task = (async () => {
      while (pending && epoch === generation) {
        const next = pending, savedRevision = revision;
        pending = null;
        try {
          const result = await request('PUT', { state: next, expectedVersion: version }, epoch);
          if (epoch !== generation) return false;
          version = result.version;
          writeMeta(savedRevision !== revision);
          notify(savedRevision === revision ? 'saved' : 'saving', savedRevision === revision ? '계정에 저장했습니다.' : '변경 내용을 저장하고 있습니다.');
        } catch (error) {
          if (epoch === generation) { if (!pending) pending = next; failure(error); }
          return false;
        }
      }
      return epoch === generation;
    })();
    inFlight = task;
    const ok = await task;
    if (epoch === generation) inFlight = null;
    return ok;
  }
  async function sync(localState, { discardLocal = false } = {}) {
    if (!userId) return localState;
    if (!apiBase) { notify('offline', '계정 저장 서버가 설정되지 않았습니다.'); return localState; }
    const epoch = generation;
    clearTimeout(timer);
    if (inFlight) await inFlight;
    if (epoch !== generation) throw new DOMException('Account changed', 'AbortError');
    const initialRevision = revision;
    localState = { ...localState, ...load() };
    const cachedMeta = meta();
    try {
      notify('loading', '학습 데이터를 불러오는 중입니다.');
      const remote = await request('GET', undefined, epoch);
      if (epoch !== generation) throw new DOMException('Account changed', 'AbortError');
      if (initialRevision !== revision) {
        notify('offline', '불러오는 동안 변경한 데이터는 기기에 보관했습니다. 저장 재시도를 눌러 주세요.');
        return load();
      }
      const remoteVersion = remote.version || 0;
      if (!discardLocal && cachedMeta.dirty && cachedMeta.version !== remoteVersion) {
        blocked = true; hydrated = true;
        notify('conflict', '다른 기기의 데이터와 충돌했습니다. 현재 데이터를 백업한 뒤 서버 데이터를 불러와 주세요.');
        return localState;
      }
      version = remoteVersion; hydrated = true; blocked = false;
      if (!discardLocal && cachedMeta.dirty) {
        pending = structuredClone(localState);
        await flush();
        return load();
      }
      const state = remote.state || localState;
      storage.setItem(key, JSON.stringify(state)); writeMeta(false); pending = null;
      notify('saved', remote.state ? '계정 데이터를 불러왔습니다.' : '새 계정입니다. 단어를 추가해 보세요.');
      return state;
    } catch (error) {
      if (epoch !== generation) throw error;
      failure(error); return { ...localState, ...load() };
    }
  }
  function isDirty() { return Boolean(userId && (meta().dirty || pending || inFlight)); }
  function guest() {
    const retainedKey = read(guestImportKey, null);
    const candidates = [guestKey, typeof retainedKey === 'string' && retainedKey.startsWith(guestPrefix) ? retainedKey : null, legacyGuestKey];
    for (const name of candidates) {
      const value = name ? read(name, {}) : {};
      if (hasGuestData(value)) return value;
    }
    return {};
  }
  return { setUser, load, save, sync, flush, isDirty, getStatus: () => status, guest };
}
