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
  // UTC 산술 — runtime TZ에 무관하게 calendar date 1일 빼기
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

// 특정 사용자, 특정 날짜 하루 전체 샘플 모으기
// 오늘 상태 유형 분석용.
// date = YYYY-MM-DD 기준 KST 00:00 ~ 다음날 00:00
function fetchDaySamples(userId, date) {
  const db = getDb();

  const startISO = `${date}T00:00:00+09:00`;

  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d));
  next.setUTCDate(next.getUTCDate() + 1);
  const nextDate = next.toISOString().slice(0, 10);

  const endISO = `${nextDate}T00:00:00+09:00`;

  return db.prepare(`
    SELECT metric, value, recorded_at
    FROM raw_samples
    WHERE user_id = ?
      AND recorded_at >= ?
      AND recorded_at < ?
  `).all(userId, startISO, endISO);
}

/**
 * 오늘 상태 유형 분류용 KMeans feature 생성
 *
 * 학습 코드는 WINDOW_DAYS = 1로 다시 학습했지만,
 * feature 이름은 기존 inference.json과 맞추기 위해 그대로 사용한다.
 */
function extractUserStateWindowFeatures(userId, date, windowDays = 1) {
  const samples = fetchDaySamples(userId, date);

  const byMetric = (m) =>
    samples
      .filter((s) => s.metric === m)
      .map((s) => s.value);

  let win_avg_sleep_efficiency = mean(byMetric('sleep_efficiency'));

  if (win_avg_sleep_efficiency !== null && win_avg_sleep_efficiency > 1.5) {
    win_avg_sleep_efficiency = win_avg_sleep_efficiency / 100.0;
  }

  return {
    win_avg_hrv: mean(byMetric('hrv_rmssd')),
    win_avg_rhr: mean(byMetric('rhr')),
    win_avg_sleep_duration_min: mean(byMetric('sleep_duration_min')),
    win_avg_sleep_efficiency,
    win_avg_steps: mean(byMetric('steps')),
    win_avg_sedentary_minutes: mean(byMetric('sedentary_minutes')),
  };
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

// EDA 단일 측정 → z-score
// 개인 baseline은 raw_samples의 과거 EDA 평균/std로 동적 계산.
// 표본이 3건 미만일 때는 통계적 의미가 약하므로, 일반적인 EDA 분포
// (평균 1.0 μS, 표준편차 0.5)를 가정한 default baseline을 사용해
// 첫 측정부터 의미 있는 분류가 가능하게 함.
const EDA_DEFAULT_MEAN = 1.0;
const EDA_DEFAULT_STD = 0.5;

function edaToZ(userId, edaValue) {
  const db = getDb();
  const stats = db.prepare(`
    SELECT AVG(value) AS mean, COUNT(*) AS n
    FROM raw_samples WHERE user_id = ? AND metric = 'eda'
  `).get(userId);
  if (!stats || !stats.n || stats.n < 3) {
    return (edaValue - EDA_DEFAULT_MEAN) / EDA_DEFAULT_STD;
  }

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
  extractUserStateWindowFeatures,
  edaToZ,
  prevDate,
};
