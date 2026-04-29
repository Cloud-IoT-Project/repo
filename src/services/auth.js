'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { getDb } = require('../db');

// 신규 사용자 기본 baseline (개인 데이터가 쌓이기 전 임시값)
// 성인 일반 모집단 평균 기준. 첫 7일 데이터 누적되면 개인 값으로 재보정 가능.
const DEFAULT_BASELINES = {
  baseline_hrv_mean: 30.0,
  baseline_hrv_std: 6.0,
  baseline_rhr: 65.0,
};

const USER_ID_PATTERN = /^[a-zA-Z0-9_]{3,32}$/;

async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

function issueToken(row) {
  return jwt.sign(
    { sub: row.user_id, name: row.display_name },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

async function register({ user_id, password, display_name }) {
  // 입력 검증
  if (!user_id || !USER_ID_PATTERN.test(user_id)) {
    return { ok: false, error: 'invalid_user_id', message: '아이디는 영문/숫자/언더스코어 3~32자' };
  }
  if (!password || password.length < 8) {
    return { ok: false, error: 'weak_password', message: '비밀번호는 최소 8자' };
  }

  const db = getDb();
  const existing = db.prepare('SELECT user_id FROM users WHERE user_id = ?').get(user_id);
  if (existing) {
    return { ok: false, error: 'user_id_taken', message: '이미 사용 중인 아이디' };
  }

  const password_hash = await hashPassword(password);
  db.prepare(`
    INSERT INTO users (
      user_id, password_hash, display_name,
      baseline_hrv_mean, baseline_hrv_std, baseline_rhr
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    user_id, password_hash, display_name || user_id,
    DEFAULT_BASELINES.baseline_hrv_mean,
    DEFAULT_BASELINES.baseline_hrv_std,
    DEFAULT_BASELINES.baseline_rhr,
  );

  const fresh = db.prepare('SELECT user_id, display_name FROM users WHERE user_id = ?').get(user_id);
  return {
    ok: true,
    token: issueToken(fresh),
    user: fresh,
  };
}

async function login(userId, password) {
  const db = getDb();
  const row = db.prepare('SELECT user_id, password_hash, display_name FROM users WHERE user_id = ?')
                .get(userId);
  if (!row) return null;
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return null;
  return { token: issueToken(row), user: { user_id: row.user_id, display_name: row.display_name } };
}

function verify(token) {
  return jwt.verify(token, config.jwt.secret);
}

module.exports = { hashPassword, login, register, verify };
