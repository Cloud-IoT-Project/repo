'use strict';

// 일별 평가 (아침 cron이 호출): feature 추출 → rule 적용 → daily_assessment upsert

const { getDb } = require('../db');
const { extractNightFeatures } = require('./features');
const { morningFallbackRule, buildReason, LEVEL_META } = require('./rules');

function runMorningAssessment(userId, date) {
  const features = extractNightFeatures(userId, date);

  const haveCore = features.hrv_zscore !== null
                && features.sleep_efficiency !== null
                && features.rhr_delta !== null;

  let level;
  let score;
  let reason;
  if (!haveCore) {
    level = 'NORMAL';
    score = 0;
    reason = '데이터 부족 (Fitbit 야간 측정 미수신)';
  } else {
    level = morningFallbackRule({
      hrv_z: features.hrv_zscore,
      sleep_eff: features.sleep_efficiency,
      rhr_delta: features.rhr_delta,
    });
    // 단순 점수: HRV 저하 + 수면효율 저하 + RHR 상승 정도를 0~1로 압축
    score = clamp01(
      0.5 * negToScore(features.hrv_zscore)
      + 0.3 * (1 - features.sleep_efficiency)
      + 0.2 * Math.max(0, features.rhr_delta) / 12
    );
    reason = buildReason(features);
  }

  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO daily_assessment (
      user_id, date, morning_assessment_time,
      hrv_rmssd, hrv_zscore, resting_heart_rate, rhr_delta,
      sleep_duration_min, sleep_efficiency,
      eda_last3days_mean_z, weekday,
      vulnerability_level, prediction_score, prediction_reason
    ) VALUES (
      @user_id, @date, @t,
      @hrv_rmssd, @hrv_zscore, @rhr, @rhr_delta,
      @sleep_dur, @sleep_eff,
      @eda3, @weekday,
      @level, @score, @reason
    )
    ON CONFLICT(user_id, date) DO UPDATE SET
      morning_assessment_time = excluded.morning_assessment_time,
      hrv_rmssd = excluded.hrv_rmssd,
      hrv_zscore = excluded.hrv_zscore,
      resting_heart_rate = excluded.resting_heart_rate,
      rhr_delta = excluded.rhr_delta,
      sleep_duration_min = excluded.sleep_duration_min,
      sleep_efficiency = excluded.sleep_efficiency,
      eda_last3days_mean_z = excluded.eda_last3days_mean_z,
      weekday = excluded.weekday,
      vulnerability_level = excluded.vulnerability_level,
      prediction_score = excluded.prediction_score,
      prediction_reason = excluded.prediction_reason
  `).run({
    user_id: userId,
    date,
    t: now,
    hrv_rmssd: features.hrv_rmssd,
    hrv_zscore: features.hrv_zscore,
    rhr: features.resting_heart_rate,
    rhr_delta: features.rhr_delta,
    sleep_dur: features.sleep_duration_min,
    sleep_eff: features.sleep_efficiency,
    eda3: features.eda_last3days_mean_z,
    weekday: features.weekday,
    level,
    score,
    reason,
  });

  return {
    user_id: userId,
    date,
    level,
    score,
    reason,
    meta: LEVEL_META[level],
    features,
  };
}

function clamp01(x) {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
// HRV z가 음수일수록 위험 → 0~1 점수
function negToScore(z) {
  if (z === null || z === undefined) return 0;
  return clamp01(-z / 3);
}

module.exports = { runMorningAssessment };
