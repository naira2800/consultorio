'use strict';

const env = require('../config/env');
const notificationService = require('../services/notificationService');
const { normalizePhone } = require('../services/whatsappService');

/**
 * Verificacion del webhook para WhatsApp Cloud API (Meta).
 * Meta hace un GET con hub.challenge que debemos devolver si el token coincide.
 */
function verifyCloudWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.whatsapp.cloud.verifyToken) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
}

/**
 * Extrae el telefono del remitente segun el proveedor.
 */
function extractSenderPhone(req) {
  // Twilio: application/x-www-form-urlencoded con campo "From" (whatsapp:+549...)
  if (req.body && req.body.From) {
    return normalizePhone(req.body.From);
  }
  // WhatsApp Cloud API: JSON anidado
  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (msg && msg.from) return normalizePhone(msg.from);
  } catch (_) {
    /* ignore */
  }
  return null;
}

/**
 * Paso 1 del flujo: cualquier mensaje entrante del paciente dispara la
 * respuesta automatica con el mensaje de bienvenida y el link al formulario.
 */
async function handleIncoming(req, res) {
  const from = extractSenderPhone(req);

  if (from) {
    await notificationService.sendWelcome(from);
  } else {
    console.warn('[Webhook] No se pudo determinar el remitente del mensaje.');
  }

  // Twilio acepta 200 vacio o TwiML; Cloud API espera 200. Respondemos 200.
  res.sendStatus(200);
}

module.exports = { verifyCloudWebhook, handleIncoming };
