'use strict';

require('dotenv').config();

/**
 * Centraliza la lectura de variables de entorno con valores por defecto
 * razonables para desarrollo.
 */
const env = {
  port: parseInt(process.env.PORT || '3000', 10),
  baseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
  tz: process.env.TZ || 'America/Argentina/Buenos_Aires',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'consultorio',
  },

  report: {
    cron: process.env.DAILY_REPORT_CRON || '0 20 * * *',
    channels: (process.env.DAILY_REPORT_CHANNELS || 'email,whatsapp')
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean),
  },

  whatsapp: {
    provider: (process.env.WHATSAPP_PROVIDER || 'log').toLowerCase(),
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      from: process.env.TWILIO_WHATSAPP_FROM || '',
    },
    cloud: {
      token: process.env.WHATSAPP_CLOUD_TOKEN || '',
      phoneId: process.env.WHATSAPP_CLOUD_PHONE_ID || '',
      verifyToken: process.env.WHATSAPP_CLOUD_VERIFY_TOKEN || 'mi-token-de-verificacion',
    },
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.MAIL_FROM || 'Consultorio <no-reply@consultorio.com>',
  },
};

module.exports = env;
