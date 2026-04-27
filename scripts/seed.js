'use strict';

// 데모 사용자 생성 + 개인 baseline 입력
// 실행: npm run seed

const bcrypt = require('bcryptjs');
const { getDb, close } = require('../src/db');
const { migrate } = require('../src/db/migrate');

async function seed() {
  migrate();
  const db = getDb();

  const users = [
    {
      user_id: 'user_001',
      password: 'demo1234',
      display_name: '김지훈 (페르소나 A)',
      baseline_hrv_mean: 38.0,
      baseline_hrv_std: 7.0,
      baseline_rhr: 62.0,
    },
    {
      user_id: 'user_002',
      password: 'demo1234',
      display_name: '이수진 (페르소나 B)',
      baseline_hrv_mean: 33.0,
      baseline_hrv_std: 6.0,
      baseline_rhr: 68.0,
    },
  ];

  const upsert = db.prepare(`
    INSERT INTO users (user_id, password_hash, display_name, baseline_hrv_mean, baseline_hrv_std, baseline_rhr)
    VALUES (@user_id, @password_hash, @display_name, @baseline_hrv_mean, @baseline_hrv_std, @baseline_rhr)
    ON CONFLICT(user_id) DO UPDATE SET
      password_hash = excluded.password_hash,
      display_name = excluded.display_name,
      baseline_hrv_mean = excluded.baseline_hrv_mean,
      baseline_hrv_std = excluded.baseline_hrv_std,
      baseline_rhr = excluded.baseline_rhr
  `);

  for (const u of users) {
    const password_hash = await bcrypt.hash(u.password, 10);
    upsert.run({ ...u, password_hash });
    console.log(`[seed] user ${u.user_id} (pw=${u.password}) baseline HRV=${u.baseline_hrv_mean}±${u.baseline_hrv_std}`);
  }

  console.log('[seed] done');
}

if (require.main === module) {
  seed().catch((e) => {
    console.error(e);
    process.exit(1);
  }).finally(close);
}

module.exports = { seed };
