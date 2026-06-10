// web/src/lib/cognito.js
//
// Amazon Cognito User Pool 인증 래퍼 (Cloud 단계 — bcrypt+JWT 대체).
// SPA에서 직접 Cognito와 통신해 ID 토큰을 발급받고, 그 토큰을 API Gateway
// Cognito authorizer에 전달한다 (api.js).
//
// 로그인 식별자 = email. 풀이 "이메일로 로그인"(UsernameAttributes=['email'])으로
// 구성돼 있어 username 자체가 email이어야 한다. 따라서 가입 시 username = email로
// 넘긴다. name은 풀의 필수 속성이라 비어 있으면 이메일 로컬파트로 채운다.

import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js';

const UserPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const ClientId = import.meta.env.VITE_COGNITO_CLIENT_ID;

let pool = null;
function getPool() {
  if (!pool) {
    if (!UserPoolId || !ClientId) {
      throw new Error('Cognito 설정 누락 — VITE_COGNITO_USER_POOL_ID / VITE_COGNITO_CLIENT_ID');
    }
    pool = new CognitoUserPool({ UserPoolId, ClientId });
  }
  return pool;
}

// ID 토큰 payload → 앱이 쓰는 user 객체
function idTokenToUser(idToken) {
  const p = idToken.decodePayload();
  return {
    user_id: p.sub,                 // DynamoDB PK (api_handler claims.sub와 동일)
    display_name: p.name || null,
    email: p.email || null,
  };
}

function normalizeErr(err) {
  const e = new Error(err.message || String(err));
  e.code = err.code || err.name;
  return e;
}

// 회원가입 — Pre-SignUp Lambda 트리거가 자동 확인하므로 이메일 코드 입력 불필요.
// username = email (이메일 로그인 풀이라 UUID는 InvalidParameterException으로 거부됨).
export function signUp({ email, password, displayName }) {
  return new Promise((resolve, reject) => {
    const attrs = [
      new CognitoUserAttribute({ Name: 'email', Value: email }),
      // name이 풀 필수 속성 → 비어 있으면 가입이 거부되므로 기본값을 채운다.
      new CognitoUserAttribute({ Name: 'name', Value: displayName || email.split('@')[0] }),
    ];
    getPool().signUp(email, password, attrs, null, (err) => {
      if (err) return reject(normalizeErr(err));
      resolve();
    });
  });
}

// 로그인 (USER_SRP_AUTH) — email alias로 인증
export function signIn({ email, password }) {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: getPool() });
    const auth = new AuthenticationDetails({ Username: email, Password: password });
    user.authenticateUser(auth, {
      onSuccess: (session) => resolve(idTokenToUser(session.getIdToken())),
      onFailure: (err) => reject(normalizeErr(err)),
      // 콘솔에서 임시 비밀번호로 만든 유저(FORCE_CHANGE_PASSWORD)는
      // 첫 로그인 시 비밀번호 변경을 요구한다 → 같은 비밀번호로 영구 설정하며 완료.
      // 풀에 필수 속성(name 등)이 있으면 챌린지에서 함께 요구하므로 기본값으로 채운다.
      newPasswordRequired: (_userAttributes, requiredAttributes) => {
        const fill = {};
        (requiredAttributes || []).forEach((a) => {
          const key = String(a).replace(/^userAttributes\./, '');
          if (key === 'email') return;           // email은 수정 불가 → 제외
          fill[key] = email.split('@')[0];        // name 등 기본값
        });
        user.completeNewPasswordChallenge(password, fill, {
          onSuccess: (session) => resolve(idTokenToUser(session.getIdToken())),
          onFailure: (err) => reject(normalizeErr(err)),
        });
      },
    });
  });
}

export function signOut() {
  const user = getPool().getCurrentUser();
  if (user) user.signOut();
}

// 유효한 ID 토큰 반환 (만료 시 refresh token으로 자동 갱신). 미로그인이면 null.
export function getIdToken() {
  return new Promise((resolve) => {
    const user = getPool().getCurrentUser();
    if (!user) return resolve(null);
    user.getSession((err, session) => {
      if (err || !session || !session.isValid()) return resolve(null);
      resolve(session.getIdToken().getJwtToken());
    });
  });
}

// 앱 부트스트랩용 — 저장된 세션이 유효하면 user 객체, 아니면 null
export function getCurrentUserInfo() {
  return new Promise((resolve) => {
    const user = getPool().getCurrentUser();
    if (!user) return resolve(null);
    user.getSession((err, session) => {
      if (err || !session || !session.isValid()) return resolve(null);
      resolve(idTokenToUser(session.getIdToken()));
    });
  });
}
