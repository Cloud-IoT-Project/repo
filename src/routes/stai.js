'use strict';

const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

/**
 * @openapi
 * /api/v1/evening-stai:
 *   post:
 *     summary: 저녁 STAI-S 단문항 자기평가 저장
 *     tags: [Reports]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [score]
 *             properties:
 *               score: { type: integer, minimum: 1, maximum: 5, example: 3 }
 *               note: { type: string }
 *               date: { type: string, example: '2026-04-27' }
 *     responses:
 *       201:
 *         description: 저장 완료
 */
router.post('/evening-stai', (req, res) => {
  const userId = req.user.user_id;
  const { score, note, date } = req.body || {};
  if (!Number.isInteger(score) || score < 1 || score > 5)
    return res.status(400).json({ error: 'score must be integer 1..5' });
  const d = date || new Date().toISOString().slice(0, 10);
  const db = getDb();
  db.prepare(`
    INSERT INTO evening_stai (user_id, date, score, note)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET
      score = excluded.score,
      note = excluded.note,
      recorded_at = datetime('now')
  `).run(userId, d, score, note || null);
  res.status(201).json({ user_id: userId, date: d, score, note: note || null });
});

module.exports = router;
