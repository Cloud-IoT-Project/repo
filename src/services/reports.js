'use strict';

// 일별 / 시간대별 리포트 생성 (기획서 §3-2)

const { getDb } = require('../db');
const { LEVEL_META } = require('./rules');

const TIME_BLOCKS = [
  { name: '06:00-12:00', label: '오전',     start: 6,  end: 12 },
  { name: '12:00-18:00', label: '점심 이후', start: 12, end: 18 },
  { name: '18:00-24:00', label: '저녁',     start: 18, end: 24 },
];

function blockOfHour(hour) {
  return TIME_BLOCKS.find((b) => hour >= b.start && hour < b.end) || null;
}

// recorded_at(ISO, UTC 'Z' 또는 +09:00 어느 쪽이든) → KST 기준 hour (0~23)
function kstHour(isoString) {
  const utcMs = new Date(isoString).getTime();
  return new Date(utcMs + 9 * 3600 * 1000).getUTCHours();
}

function buildDailyReport(userId, date) {
  const db = getDb();
  const assess = db.prepare(`
    SELECT * FROM daily_assessment WHERE user_id = ? AND date = ?
  `).get(userId, date);

  const edas = db.prepare(`
    SELECT recorded_at, eda_value, eda_z, classification
    FROM eda_checks WHERE user_id = ? AND date = ? ORDER BY recorded_at
  `).all(userId, date);

  const stai = db.prepare(`
    SELECT score, note, recorded_at FROM evening_stai
    WHERE user_id = ? AND date = ?
  `).get(userId, date);

  // 아침 경보와 실제 상태 일치 여부 (CAUTION 이상이면 경보, EDA HIGH 또는 STAI 4+면 실제 위험)
  let matched = null;
  if (assess) {
    const alerted = ['WARNING', 'CRITICAL'].includes(assess.vulnerability_level);
    const actualHigh = edas.some((e) => e.classification === 'HIGH_STRESS_SIGNAL')
                     || (stai && stai.score >= 4);
    matched = alerted === actualHigh;
  }

  const summary = makeSummary(assess, edas, stai, matched);

  return {
    date,
    morning_alert: assess
      ? {
          level: assess.vulnerability_level,
          ...LEVEL_META[assess.vulnerability_level],
          score: assess.prediction_score,
          reason: assess.prediction_reason,
          assessed_at: assess.morning_assessment_time,
        }
      : null,
    daytime_eda: edas,
    evening_stai: stai,
    matched_with_morning_alert: matched,
    summary,
  };
}

function makeSummary(assess, edas, stai, matched) {
  if (!assess) return '오늘 데이터가 아직 충분하지 않습니다.';
  const lvl = LEVEL_META[assess.vulnerability_level]?.label || assess.vulnerability_level;
  let s = `오늘 조기경보: ${lvl}.`;
  if (edas.length) {
    const high = edas.filter((e) => e.classification === 'HIGH_STRESS_SIGNAL').length;
    s += ` 낮 EDA ${edas.length}회 측정 (높음 ${high}회).`;
  }
  if (stai) s += ` 저녁 자기평가: ${stai.score}/5.`;
  if (matched !== null) {
    s += matched
      ? ' 아침 경보와 실제 상태가 대체로 일치했습니다.'
      : ' 아침 경보와 실제 상태에 차이가 있었습니다.';
  }
  return s;
}

// 시간대별 집계 (사용자가 그날 입력한 EDA를 시간대로 묶음)
function buildTimeBlockReport(userId, date) {
  const db = getDb();

  const edas = db.prepare(`
    SELECT recorded_at, eda_z FROM eda_checks
    WHERE user_id = ? AND date = ? AND eda_z IS NOT NULL
  `).all(userId, date);

  const assess = db.prepare(
    'SELECT vulnerability_level FROM daily_assessment WHERE user_id = ? AND date = ?'
  ).get(userId, date);
  const morningAlerted = assess && ['WARNING', 'CRITICAL'].includes(assess.vulnerability_level);

  const blocks = TIME_BLOCKS.map((b) => {
    const inBlock = edas.filter((e) => {
      const h = kstHour(e.recorded_at);
      return h >= b.start && h < b.end;
    });
    const eda_mean_z = inBlock.length
      ? inBlock.reduce((a, e) => a + e.eda_z, 0) / inBlock.length
      : null;
    return {
      time_block: b.name,
      label: b.label,
      eda_mean_z,
      manual_checks: inBlock.length,
      matched_with_morning_alert:
        morningAlerted !== null && eda_mean_z !== null
          ? morningAlerted === (eda_mean_z >= 0.3)
          : null,
    };
  });

  // 동시에 time_block_aggregate 테이블에 upsert (다른 곳에서 조회 가능하도록)
  const upsert = db.prepare(`
    INSERT INTO time_block_aggregate (user_id, date, time_block, eda_mean_z, manual_checks, matched_with_morning_alert)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, date, time_block) DO UPDATE SET
      eda_mean_z = excluded.eda_mean_z,
      manual_checks = excluded.manual_checks,
      matched_with_morning_alert = excluded.matched_with_morning_alert
  `);
  for (const b of blocks) {
    upsert.run(
      userId, date, b.time_block,
      b.eda_mean_z,
      b.manual_checks,
      b.matched_with_morning_alert === null ? null : (b.matched_with_morning_alert ? 1 : 0)
    );
  }

  // 자주 위험한 시간대 (지난 7일 기준)
  const weekStart = new Date(date + 'T00:00:00+09:00');
  weekStart.setDate(weekStart.getDate() - 7);
  const wkRows = db.prepare(`
    SELECT time_block, AVG(eda_mean_z) AS avg_z, SUM(manual_checks) AS checks
    FROM time_block_aggregate
    WHERE user_id = ? AND date >= ? AND date <= ? AND eda_mean_z IS NOT NULL
    GROUP BY time_block
    ORDER BY avg_z DESC
  `).all(userId, weekStart.toISOString().slice(0, 10), date);

  return {
    date,
    blocks,
    weekly_pattern: wkRows,
  };
}

module.exports = {
  TIME_BLOCKS,
  blockOfHour,
  buildDailyReport,
  buildTimeBlockReport,
};
