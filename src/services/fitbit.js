'use strict';

// Fitbit OAuth 2.0 (PKCE) + Web API 클라이언트
// 참고: https://dev.fitbit.com/build/reference/web-api/authorization/

const crypto = require('crypto');
const axios = require('axios');
const config = require('../config');
const { getDb } = require('../db');
const { edaToZ } = require('./features');
const { daytimeValidationRule } = require('./rules');

const AUTHORIZE_URL = process.env.FITBIT_AUTHORIZE_URL || 'https://www.fitbit.com/oauth2/authorize';
const TOKEN_URL    = process.env.FITBIT_TOKEN_URL     || 'https://api.fitbit.com/oauth2/token';
const API_BASE     = process.env.FITBIT_API_BASE      || 'https://api.fitbit.com';

// Fitbit Personal 앱은 'electrodermal_activity' scope을 정책상 거부함
// (2024년 이후 health 민감 metric scope 강화). 따라서 EDA는 사용자 수동 입력
// (UI의 EDA 모달 + /api/v1/eda-check)으로 처리하고, OAuth scope에서는 제외.
const SCOPES = ['heartrate', 'sleep', 'activity', 'profile'];
const SCOPES_WITH_EDA = [...SCOPES, 'electrodermal_activity']; // 디버그용 (?eda=true)

function isConfigured() {
  return !!(config.fitbit.clientId && config.fitbit.clientSecret && config.fitbit.redirectUri);
}

// PKCE: code_verifier (43-128 chars URL-safe) + code_challenge (S256)
function generatePkce() {
  const verifier = crypto.randomBytes(64).toString('base64url').slice(0, 96);
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function buildAuthorizeUrl({ userId, includeEda = false, redirectUri }) {
  if (!isConfigured()) throw new Error('Fitbit credentials not configured (.env)');
  const uri = redirectUri || config.fitbit.redirectUri;
  if (!uri) throw new Error('redirect_uri를 결정할 수 없습니다');

  const state = crypto.randomBytes(16).toString('hex');
  const { verifier, challenge } = generatePkce();

  const db = getDb();
  db.prepare(`
    INSERT INTO oauth_states (state, user_id, code_verifier, redirect_uri) VALUES (?, ?, ?, ?)
  `).run(state, userId, verifier, uri);

  const params = new URLSearchParams({
    client_id: config.fitbit.clientId,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: (includeEda ? SCOPES_WITH_EDA : SCOPES).join(' '),
    redirect_uri: uri,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

async function exchangeCodeForToken(code, codeVerifier, redirectUri) {
  const basic = Buffer.from(
    `${config.fitbit.clientId}:${config.fitbit.clientSecret}`
  ).toString('base64');

  const body = new URLSearchParams({
    client_id: config.fitbit.clientId,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri || config.fitbit.redirectUri,
  });

  const { data } = await axios.post(TOKEN_URL, body.toString(), {
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  return data; // { access_token, refresh_token, expires_in, scope, user_id, token_type }
}

async function refreshAccessToken(refreshToken) {
  const basic = Buffer.from(
    `${config.fitbit.clientId}:${config.fitbit.clientSecret}`
  ).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const { data } = await axios.post(TOKEN_URL, body.toString(), {
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  return data;
}

function consumeState(state) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM oauth_states WHERE state = ?').get(state);
  if (row) db.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);
  // 30분 이상 된 state 정리
  db.prepare("DELETE FROM oauth_states WHERE created_at < datetime('now', '-30 minutes')").run();
  return row;
}

function saveTokens(userId, tokenResp) {
  const db = getDb();
  const expiresAt = new Date(Date.now() + (tokenResp.expires_in * 1000) - 60_000).toISOString();
  db.prepare(`
    UPDATE users SET
      fitbit_user_id = ?,
      fitbit_access_token = ?,
      fitbit_refresh_token = ?,
      fitbit_expires_at = ?,
      fitbit_scope = ?
    WHERE user_id = ?
  `).run(
    tokenResp.user_id || null,
    tokenResp.access_token,
    tokenResp.refresh_token,
    expiresAt,
    tokenResp.scope || null,
    userId
  );
}

// 만료가 임박했으면 refresh, 아니면 그대로 access_token 반환
async function getValidAccessToken(userId) {
  const db = getDb();
  const u = db.prepare(`
    SELECT fitbit_access_token, fitbit_refresh_token, fitbit_expires_at
    FROM users WHERE user_id = ?
  `).get(userId);
  if (!u || !u.fitbit_access_token) return null;

  const expiresAt = u.fitbit_expires_at ? new Date(u.fitbit_expires_at).getTime() : 0;
  if (Date.now() < expiresAt) return u.fitbit_access_token;

  // 갱신
  const fresh = await refreshAccessToken(u.fitbit_refresh_token);
  saveTokens(userId, fresh);
  return fresh.access_token;
}

async function fitbitGet(userId, path) {
  const access = await getValidAccessToken(userId);
  if (!access) throw new Error('Fitbit not connected for this user');
  const { data } = await axios.get(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${access}`, Accept: 'application/json' },
    validateStatus: () => true,
  }).catch((e) => { throw e; });
  // axios가 throwOnError off됐으니 status 직접 검사
  return { /* placeholder */ };
}

// 위 헬퍼는 axios 응답 객체를 그대로 받지 못하게 막는 형태였음 — 명시적으로 다시 작성
async function callFitbit(userId, path) {
  const access = await getValidAccessToken(userId);
  if (!access) {
    const e = new Error('FITBIT_NOT_CONNECTED');
    e.code = 'FITBIT_NOT_CONNECTED';
    throw e;
  }
  const res = await axios.get(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${access}`, Accept: 'application/json' },
    validateStatus: () => true,
  });
  return res;
}

// ──────────────────────────────────────────────────────────
// 데이터 수집기 — 지정 날짜 야간 데이터를 raw_samples + eda_checks에 적재
// ──────────────────────────────────────────────────────────

async function syncNightForDate(userId, date /* 'YYYY-MM-DD' */) {
  const db = getDb();
  const summary = {
    date, hrv_inserted: 0, rhr_inserted: 0, sleep_inserted: 0, eda_inserted: 0, errors: [],
  };

  const insertRaw = db.prepare(`
    INSERT INTO raw_samples (user_id, recorded_at, metric, value, source, raw_json)
    VALUES (?, ?, ?, ?, 'fitbit', ?)
  `);

  // 1) HRV (overnight rmssd)
  try {
    const r = await callFitbit(userId, `/1/user/-/hrv/date/${date}/all.json`);
    if (r.status === 200 && Array.isArray(r.data?.hrv)) {
      for (const day of r.data.hrv) {
        const minutes = day.minutes || [];
        for (const m of minutes) {
          if (typeof m.value?.rmssd === 'number') {
            insertRaw.run(userId, m.minute, 'hrv_rmssd', m.value.rmssd, JSON.stringify(m));
            summary.hrv_inserted++;
          }
        }
        // daily summary fallback
        if (!minutes.length && typeof day.value?.dailyRmssd === 'number') {
          insertRaw.run(userId, `${date}T07:00:00+09:00`, 'hrv_rmssd', day.value.dailyRmssd, JSON.stringify(day));
          summary.hrv_inserted++;
        }
      }
    } else if (r.status !== 200) {
      summary.errors.push(`hrv ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`);
    }
  } catch (e) { summary.errors.push(`hrv: ${e.message}`); }

  // 2) RHR (휴식기 심박)
  try {
    const r = await callFitbit(userId, `/1/user/-/activities/heart/date/${date}/1d.json`);
    if (r.status === 200) {
      const rhr = r.data?.['activities-heart']?.[0]?.value?.restingHeartRate;
      if (typeof rhr === 'number') {
        insertRaw.run(userId, `${date}T06:00:00+09:00`, 'rhr', rhr, JSON.stringify(r.data));
        summary.rhr_inserted++;
      }
    } else {
      summary.errors.push(`rhr ${r.status}`);
    }
  } catch (e) { summary.errors.push(`rhr: ${e.message}`); }

  // 3) Sleep (지속시간 + 효율)
  try {
    const r = await callFitbit(userId, `/1.2/user/-/sleep/date/${date}.json`);
    if (r.status === 200 && Array.isArray(r.data?.sleep) && r.data.sleep.length) {
      // 메인 수면 (가장 긴 것)
      const main = r.data.sleep.reduce((a, b) => (b.duration > (a?.duration || 0) ? b : a), null);
      if (main) {
        const durationMin = Math.round(main.duration / 60000);
        const efficiency = (main.efficiency || 0) / 100;
        insertRaw.run(userId, `${date}T06:30:00+09:00`, 'sleep_duration_min', durationMin, JSON.stringify(main));
        insertRaw.run(userId, `${date}T06:30:00+09:00`, 'sleep_efficiency', efficiency, null);
        summary.sleep_inserted += 2;
      }
    } else {
      summary.errors.push(`sleep ${r.status}`);
    }
  } catch (e) { summary.errors.push(`sleep: ${e.message}`); }

  // 4) EDA: 사용자의 fitbit_scope에 'electrodermal_activity'가 있을 때만 시도.
  //    기본 OAuth flow에서는 EDA scope이 빠지므로 보통 이 분기는 진입 안 함.
  //    (스펙 §3-1에 따라 EDA는 사용자 수동 입력이 정상 흐름)
  const u = db.prepare('SELECT fitbit_scope FROM users WHERE user_id = ?').get(userId);
  if (u && (u.fitbit_scope || '').includes('electrodermal_activity')) {
    try {
      const r = await callFitbit(userId, `/1/user/-/eda/date/${date}/all.json`);
      if (r.status === 200) {
        const sessions = r.data?.eda?.[0]?.sessions || r.data?.eda || [];
        const list = Array.isArray(sessions) ? sessions : [];
        const insertCheck = db.prepare(`
          INSERT INTO eda_checks (user_id, date, recorded_at, eda_value, eda_z, classification)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const s of list) {
          const startTime = s.startTime || s.dateTime || s.start_time;
          const avgStress = s.averageStressLevel ?? s.value?.averageStressLevel ?? s.scoringTime;
          if (startTime && typeof avgStress === 'number') {
            insertRaw.run(userId, startTime, 'eda', avgStress, JSON.stringify(s));
            const z = edaToZ(userId, avgStress);
            const cls = daytimeValidationRule(z);
            insertCheck.run(userId, startTime.slice(0, 10), startTime, avgStress, z, cls);
            summary.eda_inserted++;
          }
        }
      } else {
        summary.errors.push(`eda ${r.status}`);
      }
    } catch (e) { summary.errors.push(`eda: ${e.message}`); }
  }

  return summary;
}

module.exports = {
  isConfigured,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  consumeState,
  saveTokens,
  refreshAccessToken,
  getValidAccessToken,
  callFitbit,
  syncNightForDate,
};
