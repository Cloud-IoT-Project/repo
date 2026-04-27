'use strict';

require('dotenv').config();

const path = require('path');

const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  env: process.env.NODE_ENV || 'development',
  sqlitePath: process.env.SQLITE_PATH || path.join(__dirname, '..', 'data', 'healthcare.db'),
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-only-secret-do-not-use-in-prod',
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
  },
  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    topicPrefix: process.env.MQTT_TOPIC_PREFIX || 'healthcare/v1',
  },
  cron: {
    morningSchedule: process.env.MORNING_JOB_CRON || '30 7 * * *',
    timezone: process.env.TIMEZONE || 'Asia/Seoul',
  },
  fitbit: {
    clientId: process.env.FITBIT_CLIENT_ID || '',
    clientSecret: process.env.FITBIT_CLIENT_SECRET || '',
    redirectUri: process.env.FITBIT_REDIRECT_URI || '',
  },
};

module.exports = config;
