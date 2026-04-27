'use strict';

const fs = require('fs');
const path = require('path');
const { getDb, close } = require('./index');

function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const db = getDb();
  db.exec(sql);
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
