'use strict';

const { verify } = require('../services/auth');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: 'missing_bearer_token' });
  try {
    const payload = verify(m[1]);
    req.user = { user_id: payload.sub, display_name: payload.name };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid_token', detail: e.message });
  }
}

module.exports = { requireAuth };
