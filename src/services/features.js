'use strict';

// 야간 회복 신호 + 낮 EDA feature 계산
// 출처: 기획서.pdf §2-3 night_features 스키마

const { getDb } = require('../db');

function zScore(value, mean, std) {
  if (std === null || std === undefined || std === 0) return 0;
  return (value - mean) / std;
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// 특정 사용자, 특정 야간(전날 22:00 ~ 당일 08:00 KST) 샘플 모으기
function fetchNightSamples(userId, date) {
  const db = getDb();
  const startISO = `${prevDate(date)}T22:00:00+09:00`;
  const endISO = `${date}T08:00:00+09:00`;
  return db.prepare(`
    SELECT metric, value, recorded_at
    FROM raw_samples
    WHERE user_id = ? AND recorded_at >= ? AND recorded_at < ?
  `).all(userId, startISO, endISO);
}

function prevDate(yyyymmdd) {
  const d = new Date(yyyymmdd + 'T00:00:00+09:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// 최근 3일(어제 포함) EDA z-score 평균
function eda3DayMeanZ(userId, date) {
  const db = getDb();
  const start = new Date(date + 'T00:00:00+09:00');
  start.setDate(start.getDate() - 3);
  const startStr = start.toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT eda_z FROM eda_checks
    WHERE user_id = ? AND date >= ? AND date < ?
      AND eda_z IS NOT NULL
  `).all(userId, startStr, date);
  if (!rows.length) return null;
  return mean(rows.map((r) => r.eda_z));
}

// 야간 샘플들에서 night_features 산출
function extractNightFeatures(userId, date) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
  if (!user) throw new Error(`unknown user: ${userId}`);

  const samples = fetchNightSamples(userId, date);
  const byMetric = (m) => samples.filter((s) => s.metric === m).map((s) => s.value);

  const hrvVals = byMetric('hrv_rmssd');
  const rhrVals = byMetric('rhr');
  const sleepDurVals = byMetric('sleep_duration_min');
  const sleepEffVals = byMetric('sleep_efficiency');

  const hrv_rmssd = median(hrvVals);
  const resting_heart_rate = median(rhrVals);
  const sleep_duration_min = sleepDurVals.length ? Math.round(median(sleepDurVals)) : null;
  const sleep_efficiency = median(sleepEffVals);

  const hrv_zscore = hrv_rmssd !== null
    ? zScore(hrv_rmssd, user.baseline_hrv_mean, user.baseline_hrv_std)
    : null;
  const rhr_delta = resting_heart_rate !== null && user.baseline_rhr !== null
    ? resting_heart_rate - user.baseline_rhr
    : null;

  const eda_last3days_mean_z = eda3DayMeanZ(userId, date);

  const weekday = ['SUN','MON','TUE','WED','THU','FRI','SAT'][
    new Date(date + 'T00:00:00+09:00').getDay()
  ];

  return {
    hrv_rmssd,
    hrv_zscore,
    resting_heart_rate,
    rhr_delta,
    sleep_duration_min,
    sleep_efficiency,
    eda_last3days_mean_z,
    weekday,
  };
}

// EDA 단일 측정 → z-score (개인 baseline EDA가 없을 경우 0 반환)
// (단순화: 사용자별 EDA baseline은 raw_samples의 과거 EDA 평균/std로 동적 계산)
function edaToZ(userId, edaValue) {
  const db = getDb();
  const stats = db.prepare(`
    SELECT AVG(value) AS mean, COUNT(*) AS n
    FROM raw_samples WHERE user_id = ? AND metric = 'eda'
  `).get(userId);
  if (!stats || !stats.n || stats.n < 3) return 0;

  // 표본표준편차
  const rows = db.prepare(`
    SELECT value FROM raw_samples WHERE user_id = ? AND metric = 'eda'
  `).all(userId);
  const m = stats.mean;
  const variance = rows.reduce((acc, r) => acc + (r.value - m) ** 2, 0) / (rows.length - 1);
  const std = Math.sqrt(variance);
  return std === 0 ? 0 : (edaValue - m) / std;
}

module.exports = {
  zScore,
  median,
  mean,
  extractNightFeatures,
  edaToZ,
  prevDate,
};
