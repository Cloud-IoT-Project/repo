# 스마트 헬스케어 (On-Premise) — 6팀

Fitbit 야간 회복 신호 기반 **다음날 스트레스 취약도 조기 경보 + 일별/시간대별 리포트** 서비스의 On-Premise 구현체.

> 이번 단계는 ONNX 추론을 제외하고 rule-based 로직(`docs/기획서.pdf` §3-3)으로 동작합니다. 클라우드 단계에서 ML 추론으로 업그레이드 예정.

## 빠른 시작

```bash
npm install
cp .env.example .env

npm run migrate         # SQLite 스키마 적용
npm run seed            # 데모 사용자 2명 + baseline 입력
npm run simulate -- --user user_001 --days 5 --eda   # 시뮬레이션 데이터 5일치
npm run morning-job     # 오늘 아침 평가 즉시 실행 (cron 대신 수동 트리거)

npm start               # 서버 가동 → http://localhost:8080
```

브라우저에서 `http://localhost:8080` 열고 `user_001 / demo1234`로 로그인.

## 프로젝트 구조

```
src/
  server.js             # Express entry
  config.js             # .env 로더
  db/
    schema.sql          # SQLite DDL (6개 테이블, 기획서 §2-3 기반)
    index.js            # better-sqlite3 연결
    migrate.js          # 스키마 적용
  services/
    rules.js            # morning_fallback_rule, daytime_validation_rule (§3-3)
    features.js         # HRV z-score, RHR delta, EDA z-score 등
    assessment.js       # 일별 평가 트랜잭션
    reports.js          # 일별 / 시간대별 집계
    auth.js             # bcrypt + JWT
  middleware/auth.js    # Bearer JWT 검증
  routes/
    auth.js             # POST /auth/login
    alerts.js           # GET  /morning-alert
    eda.js              # POST /eda-check
    reports.js          # GET  /reports/{daily,timeblock}
    stai.js             # POST /evening-stai
  cron/morning.js       # 매일 07:30 KST 일별 평가 (node-cron)
  mqtt/subscriber.js    # Pi → MQTT → DB 적재 (broker 있을 때만 자동 연결)
  swagger.js            # OpenAPI 스펙 빌더
scripts/
  seed.js               # 데모 사용자 + baseline 시드
  simulator.js          # Fitbit 야간 신호 가짜 데이터 생성
  run-morning-job.js    # cron 대신 수동 트리거
public/
  index.html, app.js, style.css   # 단일 페이지 대시보드 (vanilla)
data/
  healthcare.db         # SQLite (.gitignore)
  raw/                  # 원천 로그 .jsonl (S3 대체)
```

## REST API

문서: `http://localhost:8080/api/docs` (Swagger UI)

| Method | Path                                | 설명 |
|--------|-------------------------------------|------|
| POST   | `/api/v1/auth/login`                | 로그인 → JWT 발급 |
| GET    | `/api/v1/morning-alert?date=&recompute=` | 오늘(또는 지정 날짜) 아침 경보 |
| POST   | `/api/v1/eda-check`                 | 낮 EDA 측정 1회 기록 |
| POST   | `/api/v1/evening-stai`              | 저녁 STAI-S 자기평가 |
| GET    | `/api/v1/reports/daily?date=`       | 일별 리포트 |
| GET    | `/api/v1/reports/timeblock?date=`   | 시간대별 + 최근 7일 패턴 |

`/api/v1/auth/login` 외 모든 엔드포인트는 `Authorization: Bearer <jwt>` 필수.

## 시뮬레이터

Fitbit OAuth 승인 전, 또는 시연 안전장치용으로 가짜 야간 데이터를 생성:

```bash
# 어제~오늘 자동 시나리오 (50% 정상, 30% 주의, 15% 경고, 5% 위험)
npm run simulate

# 7일치 + 낮 EDA 포함
npm run simulate -- --user user_001 --days 7 --eda

# 위험 시나리오 강제 (시연용)
npm run simulate -- --scenario stressed --eda
```

시나리오: `auto` | `normal` | `caution` | `warning` | `stressed`

## 데모 흐름 (시연 영상용)

1. `npm run seed && npm run simulate -- --days 5 --eda --scenario warning`
2. `npm run morning-job` — 콘솔에 등급 출력 확인
3. `npm start`
4. 브라우저 → 로그인 → 🟠 주의 등급 + 근거 문장 보임
5. EDA 입력 폼에 1.5 입력 → 화면에 HIGH_STRESS_SIGNAL 태그
6. 저녁 자기평가 4점 저장
7. 일별 리포트의 "아침 경보와 실제 상태가 대체로 일치했습니다." 확인
8. 시간대별 차트로 점심 이후/저녁 막대 변화 확인

## MQTT (Pi 측)

Pi에서 발행할 토픽 포맷:

```
healthcare/v1/<user_id>/<metric>
```

페이로드:
```json
{ "recorded_at": "2026-04-27T07:00:00+09:00", "value": 28.4, "raw": { ... } }
```

`metric` ∈ {`hrv_rmssd`, `rhr`, `sleep_duration_min`, `sleep_efficiency`, `eda`}.

서버는 broker가 살아 있을 때만 자동 연결. 브로커 없으면 시뮬레이터로 동작.

## 클라우드 단계로 이연

이번 단계에서 의도적으로 빠진 항목 (다음 과제에서 추가):
- ONNX 기반 morning vulnerability 추론 (현재는 rule-based가 그 자리)
- 개인 모델 재보정 (EDA / STAI-S 불일치 누적 시)
- 주간 리포트 자동 생성
- 보호자 / 관리자 공유 대시보드
- 다중 사용자 통계 일반화

## 보안 요약

| 항목 | 적용 |
|------|------|
| 비밀번호 | bcrypt (cost=10) 해시 |
| 세션 | JWT (HS256, 12h 만료) |
| 전송 | MQTT TLS 권장 (`mqtts://` URL) |
| 저장 | SQLite 파일 권한 OS 레벨 제한 |
| 외부 API | Fitbit OAuth 2.0 (token refresh) |

## 팀

6팀 — 김송은, 김종혁, 장지은, 정소현 (클라우드 IoT 서비스 / 분반 3222)
