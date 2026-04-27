'use strict';

const fs = require('fs');
const path = require('path');
const { getDb, close } = require('./index');

function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const db = getDb();
  db.exec(sql);
  // 기존 테이블에 컬럼이 없는 경우 ALTER로 추가 (idempotent)
  const ensure = (table, name, ddl) => {
    const cols = db.prepare(`PRAGMA table_info('${table}')`).all().map((c) => c.name);
    if (!cols.includes(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  };
  ensure('users', 'fitbit_user_id', 'fitbit_user_id TEXT');
  ensure('users', 'fitbit_access_token', 'fitbit_access_token TEXT');
  ensure('users', 'fitbit_refresh_token', 'fitbit_refresh_token TEXT');
  ensure('users', 'fitbit_expires_at', 'fitbit_expires_at TEXT');
  ensure('users', 'fitbit_scope', 'fitbit_scope TEXT');
  ensure('oauth_states', 'redirect_uri', 'redirect_uri TEXT');
  console.log('[migrate] schema applied');
}

if (require.main === module) {
  try {
    migrate();
  } finally {
    close();
  }
}

module.exports = { migrate };
