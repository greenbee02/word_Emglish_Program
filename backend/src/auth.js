export function createAuthenticator({ url, publishableKey, fetchImpl = fetch }) {
  if (!url || !publishableKey) throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required');
  const base = new URL(url);
  if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('SUPABASE_URL must use HTTPS');
  return async function authenticate(req) {
    const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization || '');
    if (!match) throw Object.assign(new Error('로그인이 필요합니다.'), { status: 401 });
    let response;
    try {
      response = await fetchImpl(new URL('/auth/v1/user', base), {
        headers: { apikey: publishableKey, Authorization: `Bearer ${match[1]}` },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw Object.assign(new Error('인증 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'), { status: 503 });
    }
    if ([401, 403].includes(response.status)) throw Object.assign(new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.'), { status: 401 });
    if (!response.ok) throw Object.assign(new Error('인증 서비스를 확인해 주세요.'), { status: 503 });
    const user = await response.json();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id || '')) throw Object.assign(new Error('사용자 인증에 실패했습니다.'), { status: 401 });
    return user;
  };
}
