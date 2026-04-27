'use strict';

// MQTT 구독자 — Pi가 발행한 Fitbit 원천 데이터를 수신
// 메시지 포맷 (Pi → broker):
// topic: <prefix>/<user_id>/<metric>
// payload(JSON): { recorded_at: ISO8601, value: number, raw?: object }
//
// Note: 이 단계의 demo는 시뮬레이터로 직접 DB에 쓰는 흐름이라
//       MQTT는 옵셔널이고, broker가 살아 있을 때만 자동 연결됩니다.

const mqtt = require('mqtt');
const config = require('../config');
const { getDb } = require('../db');

let client = null;

function start() {
  if (client) return client;
  client = mqtt.connect(config.mqtt.brokerUrl, {
    reconnectPeriod: 5000,
    connectTimeout: 5000,
  });

  client.on('connect', () => {
    const topic = `${config.mqtt.topicPrefix}/+/+`;
    client.subscribe(topic, (err) => {
      if (err) console.error('[mqtt] subscribe error:', err.message);
      else console.log(`[mqtt] subscribed ${topic}`);
    });
  });

  client.on('error', (err) => {
    console.warn('[mqtt] error (broker may be down):', err.message);
  });

  client.on('message', (topic, payload) => {
    try {
      const parts = topic.split('/');
      // <prefix>/<user>/<metric> 의 마지막 두 토큰
      const metric = parts[parts.length - 1];
      const userId = parts[parts.length - 2];
      const msg = JSON.parse(payload.toString());
      const db = getDb();
      db.prepare(`
        INSERT INTO raw_samples (user_id, recorded_at, metric, value, source, raw_json)
        VALUES (?, ?, ?, ?, 'fitbit', ?)
      `).run(userId, msg.recorded_at, metric, msg.value, msg.raw ? JSON.stringify(msg.raw) : null);
    } catch (e) {
      console.error('[mqtt] message handling failed:', e.message);
    }
  });

  return client;
}

function stop() {
  if (client) {
    client.end();
    client = null;
  }
}

module.exports = { start, stop };
