'use strict';

const env = require('../config/env');

/**
 * Servicio de envio de mensajes de WhatsApp con soporte para varios proveedores:
 *   - "twilio": API de WhatsApp de Twilio
 *   - "cloud" : WhatsApp Cloud API de Meta
 *   - "log"   : no envia nada, solo imprime en consola (util para desarrollo)
 *
 * Todos los proveedores exponen la misma funcion sendMessage(to, body).
 */

/**
 * Normaliza un numero a formato E.164 (+549...) sin el prefijo "whatsapp:".
 */
function normalizePhone(to) {
  return String(to).replace(/^whatsapp:/i, '').trim();
}

async function sendViaLog(to, body) {
  console.log('\n===== [WhatsApp:LOG] Mensaje simulado =====');
  console.log(`  Para : ${normalizePhone(to)}`);
  console.log(`  Texto: ${body}`);
  console.log('===========================================\n');
  return { provider: 'log', to: normalizePhone(to), simulated: true };
}

async function sendViaTwilio(to, body) {
  const { accountSid, authToken, from } = env.whatsapp.twilio;
  if (!accountSid || !authToken || !from) {
    console.warn('[WhatsApp:twilio] Faltan credenciales, se usa modo log.');
    return sendViaLog(to, body);
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({
    From: from,
    To: `whatsapp:${normalizePhone(to)}`,
    Body: body,
  });
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Twilio respondio ${res.status}: ${detail}`);
  }
  return res.json();
}

async function sendViaCloud(to, body) {
  const { token, phoneId } = env.whatsapp.cloud;
  if (!token || !phoneId) {
    console.warn('[WhatsApp:cloud] Faltan credenciales, se usa modo log.');
    return sendViaLog(to, body);
  }

  const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalizePhone(to),
      type: 'text',
      text: { body },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`WhatsApp Cloud API respondio ${res.status}: ${detail}`);
  }
  return res.json();
}

/**
 * Envia un mensaje de TEMPLATE por WhatsApp Cloud API.
 * Los templates son plantillas pre-aprobadas por Meta y son la unica forma de
 * entregar mensajes que INICIA el negocio (fuera de la ventana de 24 hs).
 *
 * @param {string} to           destinatario en E.164
 * @param {object} opts
 * @param {string} opts.name        nombre del template aprobado
 * @param {string} opts.languageCode codigo de idioma (ej. "es_AR")
 * @param {string[]} opts.bodyParams valores para las variables {{1}}, {{2}}, ...
 */
async function sendTemplateViaCloud(to, { name, languageCode, bodyParams }) {
  const { token, phoneId } = env.whatsapp.cloud;
  if (!token || !phoneId) {
    console.warn('[WhatsApp:cloud] Faltan credenciales, se usa modo log.');
    return sendViaLog(to, `[TEMPLATE ${name}] ${(bodyParams || []).join(' | ')}`);
  }

  const components =
    bodyParams && bodyParams.length
      ? [
          {
            type: 'body',
            parameters: bodyParams.map((t) => ({ type: 'text', text: String(t) })),
          },
        ]
      : [];

  const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalizePhone(to),
      type: 'template',
      template: { name, language: { code: languageCode }, components },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`WhatsApp Cloud API (template) respondio ${res.status}: ${detail}`);
  }
  return res.json();
}

/**
 * Envia un template usando el proveedor configurado. En "log" imprime en
 * consola; en "twilio" (que maneja templates de otra forma) cae a log para no
 * romper el flujo.
 */
async function sendTemplate(to, opts) {
  if (!to) {
    console.warn('[WhatsApp] Destinatario vacio, template omitido.');
    return null;
  }
  try {
    switch (env.whatsapp.provider) {
      case 'cloud':
        return await sendTemplateViaCloud(to, opts);
      case 'twilio':
      case 'log':
      default:
        return await sendViaLog(to, `[TEMPLATE ${opts.name}] ${(opts.bodyParams || []).join(' | ')}`);
    }
  } catch (err) {
    console.error(`[WhatsApp] Error al enviar template a ${to}:`, err.message);
    return null;
  }
}

/**
 * Envia un mensaje de texto por WhatsApp usando el proveedor configurado.
 * Nunca lanza hacia arriba en caso de error de red: registra y continua,
 * para que un fallo de notificacion no rompa el flujo principal.
 */
async function sendMessage(to, body) {
  if (!to) {
    console.warn('[WhatsApp] Destinatario vacio, mensaje omitido.');
    return null;
  }
  try {
    switch (env.whatsapp.provider) {
      case 'twilio':
        return await sendViaTwilio(to, body);
      case 'cloud':
        return await sendViaCloud(to, body);
      case 'log':
      default:
        return await sendViaLog(to, body);
    }
  } catch (err) {
    console.error(`[WhatsApp] Error al enviar a ${to}:`, err.message);
    return null;
  }
}

module.exports = { sendMessage, sendTemplate, normalizePhone };
