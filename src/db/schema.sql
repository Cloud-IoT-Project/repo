-- 스마트 헬스케어 On-Premise DB 스키마
-- 출처: 기획서.pdf §2-3 (night_features / prediction / daytime_validation / time-block aggregate)

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- 사용자 + 개인 baseline (HRV z-score 계산에 필요)
CREATE TABLE IF NOT EXISTS users (
  user_id          TEXT PRIMARY KEY,
  password_hash    TEXT NOT NULL,
  display_name     TEXT,
  baseline_hrv_mean   REAL,   -- 개인 야간 HRV(rMSSD) 평균
  baseline_hrv_std    REAL,   -- 개인 야간 HRV 표준편차
  baseline_rhr        REAL,   -- 개인 휴식기 심박 평균
  -- Fitbit OAuth 2.0 (사용자가 본인 계정 연결 시 채워짐)
  fitbit_user_id        TEXT,
  fitbit_access_token   TEXT,
  fitbit_refresh_token  TEXT,
  fitbit_expires_at     TEXT,        -- ISO8601
  fitbit_scope          TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- OAuth state 저장 (CSRF 방지용, 짧은 수명)
CREATE TABLE IF NOT EXISTS oauth_states (
  state         TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 원천 샘플 (Fitbit/시뮬레이터에서 들어온 모든 측정값)
-- metric: 'hrv_rmssd' | 'rhr' | 'sleep_duration_min' | 'sleep_efficiency' | 'eda'
CREATE TABLE IF NOT EXISTS raw_samples (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT NOT NULL,
  recorded_at   TEXT NOT NULL,           -- ISO8601 KST
  metric        TEXT NOT NULL,
  value         REAL NOT NULL,
  source        TEXT NOT NULL,           -- 'fitbit' | 'simulator' | 'manual'
  raw_json      TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
CREATE INDEX IF NOT EXISTS idx_raw_user_time   ON raw_samples(user_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_raw_user_metric ON raw_samples(user_id, metric, recorded_at);

-- 일별 평가 결과 (아침 07:30 cron이 채움)
-- 기획서 §2-3의 night_features + prediction + daytime_validation을 펼쳐서 저장
CREATE TABLE IF NOT EXISTS daily_assessment (
  user_id                  TEXT NOT NULL,
  date                     TEXT NOT NULL,   -- 'YYYY-MM-DD'
  morning_assessment_time  TEXT,
  hrv_rmssd                REAL,
  hrv_zscore               REAL,
  resting_heart_rate       REAL,
  rhr_delta                REAL,
  sleep_duration_min       INTEGER,
  sleep_efficiency         REAL,
  eda_last3days_mean_z     REAL,
  weekday                  TEXT,
  vulnerability_level      TEXT,            -- 'NORMAL' | 'CAUTION' | 'WARNING' | 'CRITICAL'
  prediction_score         REAL,
  prediction_reason        TEXT,
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, date),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- 낮 EDA 검증 측정 (사용자가 수동으로 2~3회 입력)
CREATE TABLE IF NOT EXISTS eda_checks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT NOT NULL,
  date          TEXT NOT NULL,
  recorded_at   TEXT NOT NULL,
  eda_value     REAL NOT NULL,             -- 원시 EDA (μS)
  eda_z         REAL,                       -- 개인 baseline 기준 z-score
  classification TEXT,                      -- 'LOW_SIGNAL' | 'MODERATE_SIGNAL' | 'HIGH_STRESS_SIGNAL'
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
CREATE INDEX IF NOT EXISTS idx_eda_user_date ON eda_checks(user_id, date);

-- 저녁 STAI-S 자기평가 (단문항, 1~5 likert)
CREATE TABLE IF NOT EXISTS evening_stai (
  user_id      TEXT NOT NULL,
  date         TEXT NOT NULL,
  score        INTEGER NOT NULL,            -- 1=매우 평온 ~ 5=매우 긴장
  note         TEXT,
  recorded_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, date),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- 시간대별 집계 (기획서 §2-3 두 번째 JSON)
-- time_block: '06:00-12:00' | '12:00-18:00' | '18:00-24:00'
CREATE TABLE IF NOT EXISTS time_block_aggregate (
  user_id                     TEXT NOT NULL,
  date                        TEXT NOT NULL,
  time_block                  TEXT NOT NULL,
  eda_mean_z                  REAL,
  manual_checks               INTEGER NOT NULL DEFAULT 0,
  matched_with_morning_alert  INTEGER,        -- 0/1 (SQLite has no bool)
  PRIMARY KEY (user_id, date, time_block),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
