'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const swaggerUi = require('swagger-ui-express');

const config = require('./config');
const swaggerSpec = require('./swagger');
const { requireAuth } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const alertsRoutes = require('./routes/alerts');
const edaRoutes = require('./routes/eda');
const reportsRoutes = require('./routes/reports');
const staiRoutes = require('./routes/stai');
const fitbitRoutes = require('./routes/fitbit');

const app = express();

// EC2 등 reverse proxy/LB 뒤에서 X-Forwarded-For 신뢰
app.set('trust proxy', 1);

// 보안 헤더 + CSP. React 빌드는 inline script가 없지만 Swagger UI는 있어서
// 'unsafe-inline'을 허용. 클래스 프로젝트 시연 수준에선 합리적인 트레이드오프.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:'],
      'connect-src': ["'self'"],
      'object-src': ["'none'"],
      'frame-ancestors': ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
}));

// CORS — ALLOWED_ORIGINS env 화이트리스트 기반. 미설정 시 모든 origin 허용 (dev only).
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length
    ? (origin, cb) => {
        // origin 없는 요청(curl, Postman, 같은-origin)도 허용
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: origin ${origin} not allowed`));
      }
    : true,
  credentials: false,
}));

app.use(express.json({ limit: '256kb' }));

// 무차별 대입 방지 — 로그인은 IP당 15분에 5회로 제한
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_login_attempts', retry_after_min: 15 },
});

// OAuth authorize URL 생성도 IP당 15분에 10회로 제한 (state spam 방지)
const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_oauth_requests' },
});

// 일반 API 보호 (선의의 사용자 영향 최소화 — 분당 100회)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

// 헬스체크
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'smart-healthcare', env: config.env }));

// 인증 (auth는 자체에서 토큰 발급) — 무차별 대입 방지 limiter 부착
app.use('/api/v1/auth', loginLimiter, authRoutes);

// Fitbit: /callback은 Fitbit이 직접 호출하므로 JWT 면제 (state로 검증).
// /authorize는 oauthLimiter, 나머지는 apiLimiter + requireAuth.
// ※ 아래 /api/v1 generic mount보다 먼저 와야 함 — 아니면 그쪽 requireAuth가 먼저 401 반환.
app.use('/api/v1/fitbit', (req, res, next) => {
  if (req.path === '/callback') return next();
  if (req.path === '/authorize') return oauthLimiter(req, res, () => requireAuth(req, res, next));
  return apiLimiter(req, res, () => requireAuth(req, res, next));
}, fitbitRoutes);

// 보호된 엔드포인트 — apiLimiter + JWT
app.use('/api/v1', apiLimiter, requireAuth, alertsRoutes);
app.use('/api/v1', apiLimiter, requireAuth, edaRoutes);
app.use('/api/v1/reports', apiLimiter, requireAuth, reportsRoutes);
app.use('/api/v1', apiLimiter, requireAuth, staiRoutes);

// API 문서
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/openapi.json', (_req, res) => res.json(swaggerSpec));

// 정적 대시보드
app.use(express.static(path.join(__dirname, '..', 'public')));

// 404
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not_found' });
  res.status(404).send('Not found');
});

// 에러 핸들러
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'internal_error', detail: err.message });
});

if (require.main === module) {
  // cron 부팅 (process.env로 끌 수 있게)
  if (process.env.DISABLE_CRON !== '1') {
    require('./cron/morning').schedule();
  }
  app.listen(config.port, () => {
    console.log(`[server] http://localhost:${config.port}`);
    console.log(`[server] api docs: http://localhost:${config.port}/api/docs`);
  });
}

module.exports = app;
