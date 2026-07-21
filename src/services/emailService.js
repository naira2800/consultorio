'use strict';

const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;

/**
 * Crea (una sola vez) el transporte SMTP. Si no hay credenciales configuradas,
 * devuelve null y los envios se registran en consola en lugar de enviarse.
 */
function getTransporter() {
  if (transporter) return transporter;
  if (!env.smtp.host || !env.smtp.user) return null;

  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: { user: env.smtp.user, pass: env.smtp.password },
  });
  return transporter;
}

/**
 * Envia un email. Si no hay SMTP configurado, lo imprime en consola.
 */
async function sendMail({ to, subject, html, text }) {
  if (!to) return null;
  const tx = getTransporter();

  if (!tx) {
    console.log('\n===== [Email:LOG] Mail simulado =====');
    console.log(`  Para   : ${to}`);
    console.log(`  Asunto : ${subject}`);
    console.log(`  Texto  : ${text || '(html)'}`);
    console.log('=====================================\n');
    return { simulated: true };
  }

  try {
    return await tx.sendMail({ from: env.smtp.from, to, subject, html, text });
  } catch (err) {
    console.error(`[Email] Error al enviar a ${to}:`, err.message);
    return null;
  }
}

module.exports = { sendMail };
