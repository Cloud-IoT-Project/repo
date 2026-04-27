'use strict';

const express = require('express');
const { login } = require('../services/auth');

const router = express.Router();

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     summary: 로그인 후 JWT 발급
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id, password]
 *             properties:
 *               user_id: { type: string, example: user_001 }
 *               password: { type: string, example: demo1234 }
 *     responses:
 *       200:
 *         description: 토큰 + 사용자 정보
 *       401:
 *         description: 인증 실패
 */
router.post('/login', async (req, res) => {
  const { user_id, password } = req.body || {};
  if (!user_id || !password)
    return res.status(400).json({ error: 'user_id and password required' });
  try {
    const result = await login(user_id, password);
    if (!result) return res.status(401).json({ error: 'invalid_credentials' });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'login_error', detail: e.message });
  }
});

module.exports = router;
