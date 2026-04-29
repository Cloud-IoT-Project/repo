'use strict';

// Fitbit 데이터 시뮬레이터
// 사용법:
//   node scripts/simulator.js                              # 기본: user_001, 어제~오늘 야간
//   node scripts/simulator.js --user user_002 --days 7    # 7일치 야간 데이터
//   node scripts/simulator.js --scenario stressed         # 위험 시나리오 강제
//   node scripts/simulator.js --eda                       # 추가로 낮 EDA 측정 3회 생성

const { getDb, close } = require('../src/db');
const { migrate } = require('../src/db/migrate');

function parseArgs(argv) {
  const args = { user: 'user_001', days: 1, scenario: 'auto', eda: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--user') args.user = argv[++i];
    else if (a === '--days') args.days = parseInt(argv[++i], 10);
    else if (a === '--scenario') args.scenario = argv[++i];
    else if (a === '--eda') args.eda = true;
  }
  return args;
}

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xFFFFFFFF;
  };
}
function gauss(rand, mean, std) {
  // Box-Muller
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function dateAddDays(yyyymmdd, delta) {
  // UTC 산술 — runtime TZ에 무관하게 calendar date ± delta
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}
function todayKST() {
  const d = new Date();
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

// 시나리오별 야간 회복 신호 생성
function nightProfile(scenario, rand, baseline) {
  switch (scenario) {
    case 'stressed': // CRITICAL 유도
      return {
        hrv: gauss(rand, baseline.hrv_mean - 2.5 * baseline.hrv_std, 2),
        rhr: baseline.rhr + 10,
        sleep_min: gauss(rand, 280, 30),
        sleep_eff: gauss(rand, 0.65, 0.05),
      };
    case 'warning':
      return {
        hrv: gauss(rand, baseline.hrv_mean - 1.7 * baseline.hrv_std, 1.5),
        rhr: baseline.rhr + 4,
        sleep_min: gauss(rand, 360, 25),
        sleep_eff: gauss(rand, 0.70, 0.04),
      };
    case 'caution':
      return {
        hrv: gauss(rand, baseline.hrv_mean - 1.0 * baseline.hrv_std, 1.5),
        rhr: baseline.rhr + 2,
        sleep_min: gauss(rand, 400, 30),
        sleep_eff: gauss(rand, 0.80, 0.04),
      };
    case 'normal':
      return {
        hrv: gauss(rand, baseline.hrv_mean, baseline.hrv_std * 0.5),
        rhr: baseline.rhr,
        sleep_min: gauss(rand, 440, 30),
        sleep_eff: gauss(rand, 0.88, 0.03),
      };
    default: { // auto: 50% normal, 30% caution, 15% warning, 5% critical
      const r = rand();
      if (r < 0.5) return nightProfile('normal', rand, baseline);
      if (r < 0.8) return nightProfile('caution', rand, baseline);
      if (r < 0.95) return nightProfile('warning', rand, baseline);
      return nightProfile('stressed', rand, baseline);
    }
  }
}

function insertNight(db, userId, date, profile) {
  // 야간 22:00~08:00 사이 점들로 흩어 저장
  const insert = db.prepare(`
    INSERT INTO raw_samples (user_id, recorded_at, metric, value, source)
    VALUES (?, ?, ?, ?, 'simulator')
  `);
  const prevDay = dateAddDays(date, -1);
  // HRV: 23:00~07:00 사이 6포인트
  for (let h = 23; h < 31; h += Math.ceil(8 / 6)) {
    const hour = h % 24;
    const day = h >= 24 ? date : prevDay;
    const ts = `${day}T${String(hour).padStart(2, '0')}:00:00+09:00`;
    insert.run(userId, ts, 'hrv_rmssd', profile.hrv + (Math.random() - 0.5) * 2);
  }
  // RHR
  insert.run(userId, `${date}T06:00:00+09:00`, 'rhr', profile.rhr);
  // 수면: 06:00 시점에 한 번 통합 저장
  insert.run(userId, `${date}T06:30:00+09:00`, 'sleep_duration_min', Math.max(120, Math.round(profile.sleep_min)));
  insert.run(userId, `${date}T06:30:00+09:00`, 'sleep_efficiency',
    Math.max(0.4, Math.min(0.99, profile.sleep_eff)));
}

function insertDayEda(db, userId, date, rand) {
  // 시간별 EDA: 점심 후, 오후, 저녁에 1회씩
  const hours = [13, 16, 20];
  const insertRaw = db.prepare(`
    INSERT INTO raw_samples (user_id, recorded_at, metric, value, source)
    VALUES (?, ?, 'eda', ?, 'simulator')
  `);
  for (const h of hours) {
    const ts = `${date}T${String(h).padStart(2, '0')}:00:00+09:00`;
    const val = Math.max(0.1, gauss(rand, 1.0, 0.5));
    insertRaw.run(userId, ts, val);
  }
}

function main() {
  const args = parseArgs(process.argv);
  migrate();
  const db = getDb();

  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(args.user);
  if (!user) {
    console.error(`[sim] user ${args.user} not found. run "npm run seed" first.`);
    process.exit(1);
  }

  const baseline = {
    hrv_mean: user.baseline_hrv_mean,
    hrv_std: user.baseline_hrv_std,
    rhr: user.baseline_rhr,
  };

  const today = todayKST();
  const rand = rng(Date.now() & 0xFFFFFFFF);

  for (let i = args.days - 1; i >= 0; i--) {
    const date = dateAddDays(today, -i);
    const profile = nightProfile(args.scenario, rand, baseline);
    insertNight(db, args.user, date, profile);
    if (args.eda || args.days > 1) insertDayEda(db, args.user, date, rand);
    console.log(`[sim] ${args.user} ${date} scenario=${args.scenario} HRV~${profile.hrv.toFixed(1)} sleep_eff~${profile.sleep_eff.toFixed(2)}`);
  }

  console.log('[sim] done. Tip: 다음 단계로 "npm run morning-job" 실행하면 daily_assessment가 채워집니다.');
}

if (require.main === module) {
  try { main(); } finally { close(); }
}
