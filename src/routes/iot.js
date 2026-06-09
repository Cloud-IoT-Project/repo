/**'use strict';

const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

function getRawColumnName(db) {
  const cols = db.prepare(`PRAGMA table_info(raw_samples)`).all();
  const names = cols.map((c) => c.name);

  if (names.includes('raw')) return 'raw';
  if (names.includes('raw_json')) return 'raw_json';

  return null;
}

router.post('/sensor-data', (req, res) => {
  const db = getDb();

  const expectedSecret = process.env.IOT_INGEST_SECRET;
  const receivedSecret = req.headers['x-iot-secret'];

  if (expectedSecret && receivedSecret !== expectedSecret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const {
    user_id,
    recorded_at,
    metrics,
    raw,
  } = req.body || {};

  if (!user_id || !recorded_at || !metrics || typeof metrics !== 'object') {
    return res.status(400).json({
      error: 'user_id, recorded_at, metrics are required',
    });
  }

  const rawColumn = getRawColumnName(db);
  const rawText = JSON.stringify(raw || {});

  let insert;

  if (rawColumn) {
    insert = db.prepare(`
      INSERT INTO raw_samples (user_id, recorded_at, metric, value, ${rawColumn})
      VALUES (?, ?, ?, ?, ?)
    `);
  } else {
    insert = db.prepare(`
      INSERT INTO raw_samples (user_id, recorded_at, metric, value)
      VALUES (?, ?, ?, ?)
    `);
  }

  const inserted = [];

  const tx = db.transaction(() => {
    for (const [metric, value] of Object.entries(metrics)) {
      if (value === null || value === undefined || Number.isNaN(Number(value))) {
        continue;
      }

      if (rawColumn) {
        insert.run(user_id, recorded_at, metric, Number(value), rawText);
      } else {
        insert.run(user_id, recorded_at, metric, Number(value));
      }

      inserted.push(metric);
    }
  });

  tx();

  res.json({
    status: 'ok',
    inserted_metrics: inserted,
  });
});

module.exports = router;
*/








'use strict';

const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

router.post('/sensor-data', (req, res) => {
  const db = getDb();

  const expectedSecret = process.env.IOT_INGEST_SECRET;
  const receivedSecret = req.headers['x-iot-secret'];

  if (expectedSecret && receivedSecret !== expectedSecret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const {
    user_id,
    recorded_at,
    metrics,
    raw,
  } = req.body || {};

  if (!user_id || !recorded_at || !metrics || typeof metrics !== 'object') {
    return res.status(400).json({
      error: 'user_id, recorded_at, metrics are required',
    });
  }

  const source = raw?.source || 'aws_iot';
  const rawJson = JSON.stringify(raw || {});

  const insert = db.prepare(`
    INSERT INTO raw_samples (user_id, recorded_at, metric, value, source, raw_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const inserted = [];

  const tx = db.transaction(() => {
    for (const [metric, value] of Object.entries(metrics)) {
      if (value === null || value === undefined || Number.isNaN(Number(value))) {
        continue;
      }

      insert.run(
        user_id,
        recorded_at,
        metric,
        Number(value),
        source,
        rawJson
      );

      inserted.push(metric);
    }
  });

  tx();

  res.json({
    status: 'ok',
    inserted_metrics: inserted,
  });
});

module.exports = router;
