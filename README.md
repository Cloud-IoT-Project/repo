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
npm run build:web       # React 대시보드 빌드 → public/ 출력 (UI 변경 후 재실행)

npm start               # 서버 가동 → http://43.202.54.55:8080
```

UI 개발 중에는 별도 dev server를 쓰면 HMR 가능:

```bash
npm run dev:web   # http://localhost:5173 (Vite, /api 요청은 8080으로 proxy)
```

브라우저에서 `http://43.202.54.55:8080` 열고 `user_001` (또는 `user_002`)로 로그인. 비밀번호는 `.env`의 `DEMO_PASSWORD` 값(미설정 시 `demo1234`).

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
web/                  # React 대시보드 소스 (Vite + Tailwind v4)
  index.html
  src/
    main.jsx, App.jsx
    components/       # FitbitCard, MorningAlertCard, EdaModal, TimeBlockChart, ...
    lib/api.js, format.js
public/               # `npm run build:web` 산출물 (Express가 정적 서빙)
data/
  healthcare.db         # SQLite (.gitignore)
  raw/                  # 원천 로그 .jsonl (S3 대체)
```

## REST API

문서: `http://43.202.54.55:8080/api/docs` (Swagger UI)

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

## Fitbit 연동 범위

| 데이터 | 용도 | 수집 방식 |
|--------|------|----------|
| 야간 HRV (rmssd) | 아침 경보 핵심 신호 | **Fitbit 자동 sync** |
| 휴식기 심박 (RHR) | RHR Δ 계산 | **Fitbit 자동 sync** |
| 수면 시간 / 효율 | sleep_efficiency 임계값 | **Fitbit 자동 sync** |
| 낮 EDA 측정값 | 아침 경보 사후 검증 | **사용자 수동 입력** |

> Fitbit Personal 앱은 `electrodermal_activity` scope을 정책상 거부합니다 (2024년 이후 health 민감 metric scope 강화). 따라서 EDA는 사용자가 디바이스에서 측정 후 폰의 Fitbit 앱에 표시된 평균값을 우리 앱에 입력하는 흐름으로 구현했습니다 — 이는 기획서 §3-1 MVP의 "**수동** EDA 측정" 항목과도 일치합니다. 디버그/추후 review 통과 대비로 `?eda=true` 옵션은 남겨두었습니다.

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
| 비밀번호 | bcrypt (cost=10) 해시. 데모 비밀번호는 `.env`의 `DEMO_PASSWORD`로 설정 |
| 세션 | JWT (HS256, 12h 만료). `JWT_SECRET`은 `openssl rand -hex 32`로 생성 권장 |
| 무차별 대입 방지 | `express-rate-limit` — 로그인 IP당 15분 5회 제한, OAuth authorize 15분 10회 |
| CORS | `ALLOWED_ORIGINS` 화이트리스트. 미설정 시 dev용 fallback (모든 origin 허용) |
| 보안 헤더 | helmet — CSP, HSTS, X-Frame-Options, frame-ancestors 'none' 등 |
| 전송 | MQTT TLS 권장 (`mqtts://` URL). HTTP API는 reverse proxy + Let's Encrypt로 HTTPS 권장 |
| 저장 | SQLite 파일 권한 `chmod 600`, `.env`도 동일 |
| 외부 API | Fitbit OAuth 2.0 PKCE + token refresh, state CSRF 방지 (30분 만료, 1회용) |
| OWASP 알려진 취약점 | `npm audit` 결과 4개 moderate (esbuild/uuid transitive) — 모두 dev tool 또는 영향도 낮은 transitive |

## Terms of Service (이용 약관)

본 서비스("스마트 헬스케어 On-Premise")는 **클라우드 IoT 서비스** 강의의 팀 프로젝트이며, 비상업적 교육·연구 목적의 프로토타입입니다.

- 본 서비스는 개인적인 건강 데이터 분석·시각화 목적으로만 사용되며, 수집된 데이터는 외부에 공유·판매·공개되지 않습니다.
- 본 서비스는 **의학적 진단·치료 도구가 아닙니다**. 모든 경보 및 리포트는 참고용이며, 건강 관련 결정은 본인 또는 전문가가 내려야 합니다.
- 사용자는 언제든 서비스 이용을 중단하고 본인 데이터의 삭제를 요청할 수 있습니다.
- 본 서비스는 "있는 그대로(as-is)" 제공되며, 가용성·정확성에 대해 어떠한 보증도 제공하지 않습니다.
- 강의 평가 종료 후 본 프로젝트는 운영을 중단하며, 보유 데이터는 모두 삭제됩니다.

## Privacy Policy (개인정보 처리방침)

### 수집 항목
- Fitbit Web API를 통해 수신하는 야간 심박변이도(HRV), 휴식기 심박수(RHR), 수면 시간·효율, 수동 EDA 측정값
- 사용자 식별자(`user_id`) 및 비밀번호 해시(bcrypt, 평문 비밀번호는 저장하지 않음)
- Fitbit OAuth 2.0 access / refresh 토큰

### 저장 위치
- 모든 데이터는 **팀의 로컬 노트북 한 대(On-Premise)** 에 SQLite 파일 형태로만 저장됩니다.
- 외부 클라우드 서비스나 제3자 서버로 전송·복제되지 않습니다.
- Fitbit OAuth 토큰은 로컬 환경 변수 또는 DB에만 보관되며, 제3자에게 공유되지 않습니다.

### 이용 목적
- 강의 평가 시연 및 학습용 알고리즘(다음날 스트레스 취약도 조기 경보) 검증
- 사용자 본인의 건강 패턴을 일별·시간대별 리포트로 시각화

### 제3자 제공
- **없음.** 어떤 데이터도 제3자에게 제공·판매·공유되지 않습니다.
- Fitbit Web API 호출은 사용자 본인 데이터를 가져오기 위한 목적에 한정됩니다.

### 데이터 보유 및 삭제
- 강의(2026학년도 1학기) 종료 시 모든 사용자 데이터를 삭제합니다.
- 시연 진행 중에도 사용자가 요청하면 즉시 해당 사용자의 모든 데이터를 삭제합니다.
- 사용자는 본인 계정에 연결된 Fitbit OAuth 권한을 https://www.fitbit.com/settings/applications 에서 직접 회수할 수 있습니다.

### 보안 조치
- 비밀번호는 bcrypt(cost=10)로 해시 저장
- API 인증은 JWT(HS256, 12시간 만료) 기반 Bearer 토큰
- Raspberry Pi ↔ 백엔드 통신은 MQTT over TLS 권장
- SQLite 파일은 OS 레벨 권한으로 접근 제한

### 문의
데이터 삭제 요청·문의: **jnghukkim@gmail.com**

### 변경 이력
- 2026-04-27: 최초 작성

## 팀

6팀 — 김송은, 김종혁, 장지은, 정소현 (클라우드 IoT 서비스 / 분반 3222)
