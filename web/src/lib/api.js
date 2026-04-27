const TOKEN_KEY = 'sh_token';
const USER_KEY = 'sh_user';

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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || '로그인 실패');
  return body;
}
