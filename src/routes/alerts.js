'use strict';

const express = require('express');
const { getDb } = require('../db');
const { LEVEL_META } = require('../services/rules');
const { runMorningAssessment } = require('../services/assessment');

const router = express.Router();

function todayKST() {
  const d = new Date();
  // KST = UTC+9
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

/**
 * @openapi
 * /api/v1/morning-alert:
 *   get:
 *     summary: 오늘 아침 조기 경보 조회 (없으면 즉시 평가 실행)
 *     tags: [Alerts]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string, example: '2026-04-27' }
 *         description: 'YYYY-MM-DD (생략 시 오늘 KST)'
 *       - in: query
 *         name: recompute
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: 등급 / 근거 / 행동 제안
 */
router.get('/morning-alert', (req, res) => {
  const userId = req.user.user_id;
  const date = req.query.date || todayKST();
  const db = getDb();

  let row = db.prepare('SELECT * FROM daily_assessment WHERE user_id = ? AND date = ?')
              .get(userId, date);

  if (!row || req.query.recompute === 'true') {
    runMorningAssessment(userId, date);
    row = db.prepare('SELECT * FROM daily_assessment WHERE user_id = ? AND date = ?')
            .get(userId, date);
  }

  if (!row) return res.json({ date, level: null, message: 'no data' });

  res.json({
    date,
    level: row.vulnerability_level,
    ...LEVEL_META[row.vulnerability_level],
    score: row.prediction_score,
    reason: row.prediction_reason,
    assessed_at: row.morning_assessment_time,
    features: {
      hrv_rmssd: row.hrv_rmssd,
      hrv_zscore: row.hrv_zscore,
      resting_heart_rate: row.resting_heart_rate,
      rhr_delta: row.rhr_delta,
      sleep_duration_min: row.sleep_duration_min,
      sleep_efficiency: row.sleep_efficiency,
      eda_last3days_mean_z: row.eda_last3days_mean_z,
      weekday: row.weekday,
    },
  });
});

module.exports = router;
