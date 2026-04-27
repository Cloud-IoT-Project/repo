'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { getDb } = require('../db');

async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

async function login(userId, password) {
  const db = getDb();
  const row = db.prepare('SELECT user_id, password_hash, display_name FROM users WHERE user_id = ?')
                .get(userId);
  if (!row) return null;
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return null;
  const token = jwt.sign(
    { sub: row.user_id, name: row.display_name },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
  return { token, user: { user_id: row.user_id, display_name: row.display_name } };
}

function verify(token) {
  return jwt.verify(token, config.jwt.secret);
}

module.exports = { hashPassword, login, verify };
