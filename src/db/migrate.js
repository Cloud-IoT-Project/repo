'use strict';

const fs = require('fs');
const path = require('path');
const { getDb, close } = require('./index');

function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const db = getDb();
  db.exec(sql);
  // 기존 users 테이블에 Fitbit 컬럼이 없는 경우 ALTER로 추가 (idempotent)
  const cols = db.prepare("PRAGMA table_info('users')").all().map((c) => c.name);
  const ensure = (name, ddl) => {
    if (!cols.includes(name)) db.exec(`ALTER TABLE users ADD COLUMN ${ddl}`);
  };
  ensure('fitbit_user_id', 'fitbit_user_id TEXT');
  ensure('fitbit_access_token', 'fitbit_access_token TEXT');
  ensure('fitbit_refresh_token', 'fitbit_refresh_token TEXT');
  ensure('fitbit_expires_at', 'fitbit_expires_at TEXT');
  ensure('fitbit_scope', 'fitbit_scope TEXT');
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
