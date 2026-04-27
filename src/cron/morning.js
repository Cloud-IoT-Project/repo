'use strict';

const cron = require('node-cron');
const config = require('../config');
const { getDb } = require('../db');
const { runMorningAssessment } = require('../services/assessment');

function todayKST() {
  const d = new Date();
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

function runForAllUsers(date) {
  const db = getDb();
  const users = db.prepare('SELECT user_id FROM users').all();
  const results = [];
  for (const u of users) {
    try {
      const r = runMorningAssessment(u.user_id, date);
      console.log(`[morning] ${u.user_id} ${date} → ${r.level} (score=${r.score?.toFixed?.(2)})`);
      results.push(r);
    } catch (e) {
      console.error(`[morning] ${u.user_id} failed:`, e.message);
    }
  }
  return results;
}

function schedule() {
  console.log(`[cron] morning job @ "${config.cron.morningSchedule}" (${config.cron.timezone})`);
  cron.schedule(config.cron.morningSchedule, () => {
    const date = todayKST();
    console.log(`[cron] morning job firing for ${date}`);
    runForAllUsers(date);
  }, { timezone: config.cron.timezone });
}

module.exports = { schedule, runForAllUsers };
