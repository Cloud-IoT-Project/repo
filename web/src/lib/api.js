// web/src/lib/api.js
//
// API Gateway 호출 래퍼. 인증은 Cognito ID 토큰으로 처리한다.
// ※ API Gateway REST의 Cognito authorizer는 Authorization 헤더에 'Bearer' 접두어
//   없이 raw JWT(ID 토큰)를 기대한다. (HTTP API JWT authorizer와 다른 점)

import { getIdToken, signOut } from './cognito';

// CloudFront 멀티오리진이면 상대경로(/api/v1)가 같은 도메인의 API Gateway로 라우팅됨.
// 별도 도메인 직접 호출 시 VITE_API_BASE로 절대 URL 지정.
const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

export async function api(path, opts = {}) {
  const token = await getIdToken();
  const res = await fetch(API_BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {}),  // raw ID 토큰 (Bearer 없음)
      ...(opts.headers || {}),
    },
  });

  if (res.status === 401) {
    signOut();
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
