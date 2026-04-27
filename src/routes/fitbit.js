'use strict';

const express = require('express');
const fitbit = require('../services/fitbit');
const { getDb } = require('../db');

const router = express.Router();

function todayKST() {
  const d = new Date();
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

/**
 * @openapi
 * /api/v1/fitbit/status:
 *   get:
 *     summary: 현재 사용자의 Fitbit 연결 상태
 *     tags: [Fitbit]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: connected/scope/expires 정보
 */
router.get('/status', (req, res) => {
  const db = getDb();
  const u = db.prepare(`
    SELECT fitbit_user_id, fitbit_expires_at, fitbit_scope FROM users WHERE user_id = ?
  `).get(req.user.user_id);
  res.json({
    configured: fitbit.isConfigured(),
    connected: !!(u && u.fitbit_user_id),
    fitbit_user_id: u?.fitbit_user_id || null,
    expires_at: u?.fitbit_expires_at || null,
    scope: u?.fitbit_scope || null,
  });
});

/**
 * @openapi
 * /api/v1/fitbit/authorize:
 *   get:
 *     summary: Fitbit OAuth 2.0 (PKCE) 인증 페이지 URL 생성
 *     tags: [Fitbit]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: '{ url } — 클라이언트가 redirect' }
 */
router.get('/authorize', (req, res) => {
  try {
    const url = fitbit.buildAuthorizeUrl({ userId: req.user.user_id });
    res.json({ url });
  } catch (e) {
    res.status(500).json({ error: 'authorize_failed', detail: e.message });
  }
});

/**
 * @openapi
 * /api/v1/fitbit/callback:
 *   get:
 *     summary: Fitbit OAuth 콜백 (Fitbit이 직접 redirect, JWT 불필요)
 *     tags: [Fitbit]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: state
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: HTML 페이지로 결과 표시 }
 */
router.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  if (error) {
    return res.status(400).send(htmlPage('Fitbit 인증 실패', `${error}: ${error_description || ''}`));
  }
  if (!code || !state) {
    return res.status(400).send(htmlPage('잘못된 요청', 'code 또는 state 누락'));
  }
  const stateRow = fitbit.consumeState(state);
  if (!stateRow) {
    return res.status(400).send(htmlPage('만료된 state', '인증을 다시 시도해주세요'));
  }
  try {
    const tok = await fitbit.exchangeCodeForToken(code, stateRow.code_verifier);
    fitbit.saveTokens(stateRow.user_id, tok);
    res.send(htmlPage(
      'Fitbit 연결 완료 ✓',
      `사용자 ${stateRow.user_id}의 Fitbit 계정 (id=${tok.user_id})이 연결되었습니다.<br>이 창을 닫고 대시보드로 돌아가세요.`,
      { autoClose: true }
    ));
  } catch (e) {
    const detail = e.response?.data ? JSON.stringify(e.response.data) : e.message;
    res.status(500).send(htmlPage('토큰 교환 실패', detail));
  }
});

/**
 * @openapi
 * /api/v1/fitbit/sync:
 *   post:
 *     summary: 지정 날짜 야간 데이터 + EDA 스캔을 Fitbit에서 가져와 raw_samples / eda_checks에 적재
 *     tags: [Fitbit]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string, example: '2026-04-27' }
 *     responses:
 *       200: { description: '{ date, hrv_inserted, rhr_inserted, sleep_inserted, eda_inserted, errors }' }
 */
router.post('/sync', async (req, res) => {
  const date = req.query.date || todayKST();
  const db = getDb();
  const u = db.prepare('SELECT fitbit_access_token FROM users WHERE user_id = ?').get(req.user.user_id);
  if (!u || !u.fitbit_access_token) {
    return res.status(409).json({ error: 'fitbit_not_connected' });
  }
  try {
    const summary = await fitbit.syncNightForDate(req.user.user_id, date);
    res.json(summary);
  } catch (e) {
    res.status(500).json({ error: 'sync_failed', detail: e.message });
  }
});

/**
 * @openapi
 * /api/v1/fitbit/disconnect:
 *   post:
 *     summary: Fitbit 토큰 제거 (연결 해제)
 *     tags: [Fitbit]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: ok }
 */
router.post('/disconnect', (req, res) => {
  const db = getDb();
  db.prepare(`
    UPDATE users SET
      fitbit_user_id = NULL,
      fitbit_access_token = NULL,
      fitbit_refresh_token = NULL,
      fitbit_expires_at = NULL,
      fitbit_scope = NULL
    WHERE user_id = ?
  `).run(req.user.user_id);
  res.json({ ok: true });
});

function htmlPage(title, body, opts = {}) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:-apple-system,sans-serif;padding:32px;max-width:560px;margin:0 auto;color:#111}
h1{font-size:20px}p{line-height:1.6}</style></head>
<body><h1>${title}</h1><p>${body}</p>
${opts.autoClose ? '<script>setTimeout(()=>window.close(), 1500)</script>' : ''}
</body></html>`;
}

module.exports = router;
