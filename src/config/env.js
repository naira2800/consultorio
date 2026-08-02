'use strict';

const fs = require('fs');
require('dotenv').config();

/**
 * Arma la configuracion SSL para MySQL:
 *  - Si hay un certificado CA (DB_CA_CERT = ruta al archivo .pem), lo usa y
 *    VERIFICA el servidor (lo mas seguro; recomendado para Aiven).
 *  - Si no, pero DB_SSL=true, cifra la conexion sin verificar el certificado.
 *  - Si nada de eso, no usa SSL (base local).
 * Devuelve el objeto ssl para mysql2, o null.
 */
function buildDbSsl() {
  const caPath = process.env.DB_CA_CERT || '';
  if (caPath) {
    try {
      return { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true };
    } catch (err) {
      console.warn(`[env] No se pudo leer DB_CA_CERT (${caPath}): ${err.message}`);
    }
  }
  if (String(process.env.DB_SSL || 'false') === 'true') {
    return { rejectUnauthorized: false };
  }
  return null;
}

/**
 * Centraliza la lectura de variables de entorno con valores por defecto
 * razonables para desarrollo.
 */
const env = {
  port: parseInt(process.env.PORT || '3000', 10),
  baseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
  tz: process.env.TZ || 'America/Argentina/Buenos_Aires',

  // Clave secreta para cifrar/firmar los tokens de acceso passwordless.
  // IMPORTANTE: en produccion definí un valor propio, largo y aleatorio.
  appSecret: process.env.APP_SECRET || 'dev-secret-cambialo-en-produccion',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'consultorio',
    // Objeto ssl para mysql2 (o null). Ver buildDbSsl() arriba.
    ssl: buildDbSsl(),
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
      // Template usado para notificaciones proactivas (que inicia el sistema).
      // Si esta vacio, se cae a texto libre (solo se entrega dentro de la
      // ventana de 24 hs). El template debe tener 3 variables en el cuerpo:
      // {{1}} nombre, {{2}} mensaje, {{3}} enlace.
      templateName: process.env.WHATSAPP_TEMPLATE_NAME || '',
      templateLang: process.env.WHATSAPP_TEMPLATE_LANG || 'es_AR',
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
