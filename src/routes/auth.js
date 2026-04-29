'use strict';

const express = require('express');
const { login, register } = require('../services/auth');

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

/**
 * @openapi
 * /api/v1/auth/register:
 *   post:
 *     summary: 신규 사용자 등록 후 JWT 발급 (자동 로그인)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id, password]
 *             properties:
 *               user_id: { type: string, example: jane01, description: '영문/숫자/_  3~32자' }
 *               password: { type: string, example: 'secret-pass-123', description: '최소 8자' }
 *               display_name: { type: string, example: '김지은' }
 *     responses:
 *       201: { description: 토큰 + 사용자 정보 }
 *       400: { description: invalid_user_id / weak_password }
 *       409: { description: user_id_taken }
 */
router.post('/register', async (req, res) => {
  const { user_id, password, display_name } = req.body || {};
  try {
    const result = await register({ user_id, password, display_name });
    if (!result.ok) {
      const status = result.error === 'user_id_taken' ? 409 : 400;
      return res.status(status).json({ error: result.error, message: result.message });
    }
    res.status(201).json({ token: result.token, user: result.user });
  } catch (e) {
    res.status(500).json({ error: 'register_error', detail: e.message });
  }
});

module.exports = router;
