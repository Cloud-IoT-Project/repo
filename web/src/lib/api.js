const TOKEN_KEY = 'sh_token';
const USER_KEY = 'sh_user';

// ngrok 무료 plan의 안내 페이지 우회. 어떤 값이든 헤더만 있으면 됨.
// 자체 호스팅 / cloudflared 환경에선 무시됨 (해롭지 않음).
const COMMON_HEADERS = { 'ngrok-skip-browser-warning': '1' };

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function getStoredUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function api(path, opts = {}) {
  const token = getToken();
  const res = await fetch('/api/v1' + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...COMMON_HEADERS,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) {
    clearSession();
    if (typeof window !== 'undefined') window.location.reload();
    throw new Error('인증이 만료되었습니다');
  }
  let body = null;
  try { body = await res.json(); } catch {}
  if (!res.ok) {
    const msg = body?.error || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export async function login(user_id, password) {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...COMMON_HEADERS },
    body: JSON.stringify({ user_id, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || '로그인 실패');
  return body;
}
