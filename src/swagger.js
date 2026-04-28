'use strict';

const swaggerJsdoc = require('swagger-jsdoc');

const spec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: '스마트 헬스케어 On-Premise API',
      version: '0.1.0',
      description:
        'Fitbit 기반 다음날 스트레스 취약도 조기경보 + 일별/시간대별 리포트 (On-Premise stage)',
    },
    servers: [{ url: 'http://43.202.54.55:8080' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  apis: ['./src/routes/*.js'],
});

module.exports = spec;
