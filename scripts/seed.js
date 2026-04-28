'use strict';

// 데모 사용자 생성 + 개인 baseline 입력
// 실행: npm run seed

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getDb, close } = require('../src/db');
const { migrate } = require('../src/db/migrate');

async function seed() {
  migrate();
  const db = getDb();

  // 데모 비밀번호는 .env의 DEMO_PASSWORD 값을 사용. 미설정이면 'demo1234' fallback.
  // 외부 노출 환경에선 .env의 DEMO_PASSWORD를 강한 값으로 설정 후 재시드.
  const demoPassword = process.env.DEMO_PASSWORD || 'demo1234';

  const users = [
    {
      user_id: 'user_001',
      password: demoPassword,
      display_name: '김지훈 (페르소나 A)',
      baseline_hrv_mean: 38.0,
      baseline_hrv_std: 7.0,
      baseline_rhr: 62.0,
    },
    {
      user_id: 'user_002',
      password: demoPassword,
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
    console.log(`[seed] user ${u.user_id} (pw=••••••) baseline HRV=${u.baseline_hrv_mean}±${u.baseline_hrv_std}`);
  }

  console.log(`[seed] done. 비밀번호: .env의 DEMO_PASSWORD 참조 (현재 길이=${demoPassword.length})`);
}

if (require.main === module) {
  seed().catch((e) => {
    console.error(e);
    process.exit(1);
  }).finally(close);
}

module.exports = { seed };
