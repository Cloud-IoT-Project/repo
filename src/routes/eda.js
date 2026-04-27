'use strict';

const express = require('express');
const { getDb } = require('../db');
const { edaToZ } = require('../services/features');
const { daytimeValidationRule } = require('../services/rules');

const router = express.Router();

/**
 * @openapi
 * /api/v1/eda-check:
 *   post:
 *     summary: 낮 수동 EDA 측정 1회 기록
 *     tags: [EDA]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eda_value]
 *             properties:
 *               eda_value: { type: number, example: 1.2, description: '원시 EDA(μS)' }
 *               recorded_at: { type: string, example: '2026-04-27T13:30:00+09:00' }
 *     responses:
 *       201:
 *         description: 저장된 EDA + 분류
 */
router.post('/eda-check', (req, res) => {
  const userId = req.user.user_id;
  const { eda_value } = req.body || {};
  if (typeof eda_value !== 'number')
    return res.status(400).json({ error: 'eda_value (number) required' });

  const recordedAt = req.body.recorded_at || new Date().toISOString();
  const date = recordedAt.slice(0, 10);
  const eda_z = edaToZ(userId, eda_value);
  const classification = daytimeValidationRule(eda_z);

  const db = getDb();
  const insRaw = db.prepare(`
    INSERT INTO raw_samples (user_id, recorded_at, metric, value, source)
    VALUES (?, ?, 'eda', ?, 'manual')
  `);
  const insCheck = db.prepare(`
    INSERT INTO eda_checks (user_id, date, recorded_at, eda_value, eda_z, classification)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    insRaw.run(userId, recordedAt, eda_value);
    const info = insCheck.run(userId, date, recordedAt, eda_value, eda_z, classification);
    return info.lastInsertRowid;
  });
  const id = tx();

  res.status(201).json({
    id, user_id: userId, date, recorded_at: recordedAt,
    eda_value, eda_z, classification,
  });
});

module.exports = router;
