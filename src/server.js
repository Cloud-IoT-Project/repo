'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
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

const app = express();
app.use(helmet({ contentSecurityPolicy: false })); // 정적 대시보드 inline 스크립트 허용
app.use(cors());
app.use(express.json({ limit: '256kb' }));

// 헬스체크
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'smart-healthcare', env: config.env }));

// 인증 (auth는 자체에서 토큰 발급)
app.use('/api/v1/auth', authRoutes);

// 보호된 엔드포인트
app.use('/api/v1', requireAuth, alertsRoutes);
app.use('/api/v1', requireAuth, edaRoutes);
app.use('/api/v1/reports', requireAuth, reportsRoutes);
app.use('/api/v1', requireAuth, staiRoutes);

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
