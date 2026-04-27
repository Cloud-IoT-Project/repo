'use strict';

// 수동 트리거: 모든 사용자 대해 오늘(또는 --date) 아침 평가 즉시 실행
// 사용법: node scripts/run-morning-job.js [--date 2026-04-27]

const { close } = require('../src/db');
const { runForAllUsers } = require('../src/cron/morning');

function todayKST() {
  const d = new Date();
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

function main() {
  const idx = process.argv.indexOf('--date');
  const date = idx >= 0 ? process.argv[idx + 1] : todayKST();
  console.log(`[manual] running morning assessment for ${date}`);
  const results = runForAllUsers(date);
  console.log(`[manual] processed ${results.length} users`);
}

if (require.main === module) {
  try { main(); } finally { close(); }
}
