'use strict';

const express = require('express');
const { buildDailyReport, buildTimeBlockReport } = require('../services/reports');

const router = express.Router();

function todayKST() {
  const d = new Date();
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

/**
 * @openapi
 * /api/v1/reports/daily:
 *   get:
 *     summary: 일별 리포트 (아침 경보 + 낮 EDA + 저녁 자기평가 + 일치 여부)
 *     tags: [Reports]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string, example: '2026-04-27' }
 *     responses:
 *       200:
 *         description: 일별 리포트
 */
router.get('/daily', (req, res) => {
  const userId = req.user.user_id;
  const date = req.query.date || todayKST();
  res.json(buildDailyReport(userId, date));
});

/**
 * @openapi
 * /api/v1/reports/timeblock:
 *   get:
 *     summary: 시간대별 리포트 (오전/점심 이후/저녁 + 주간 패턴)
 *     tags: [Reports]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string, example: '2026-04-27' }
 *     responses:
 *       200:
 *         description: 시간대별 + 최근 7일 패턴
 */
router.get('/timeblock', (req, res) => {
  const userId = req.user.user_id;
  const date = req.query.date || todayKST();
  res.json(buildTimeBlockReport(userId, date));
});

module.exports = router;
