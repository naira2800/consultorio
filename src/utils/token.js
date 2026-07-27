'use strict';

const crypto = require('crypto');
const env = require('../config/env');

/**
 * Tokens de acceso sin contrasena ("passwordless"), cifrados y con vencimiento.
 *
 * Se usan para reconocer a un paciente existente a partir de su numero de
 * WhatsApp (que ya fue verificado por el propio WhatsApp al escribirnos), sin
 * pedirle usuario ni clave. El token:
 *   - va CIFRADO y AUTENTICADO con AES-256-GCM (no se puede leer ni falsificar),
 *   - VENCE (un link viejo deja de servir),
 *   - no expone datos personales en la URL.
 *
 * La clave se deriva de APP_SECRET. En produccion, definí un APP_SECRET propio.
 */

const KEY = crypto.createHash('sha256').update(String(env.appSecret)).digest();

/**
 * Genera un token cifrado con los datos indicados y un vencimiento.
 * @param {object} payload  datos a incluir (ej. { phone })
 * @param {number} ttlSeconds  segundos de validez
 * @returns {string} token en formato iv.ciphertext.tag (base64url)
 */
function sign(payload, ttlSeconds) {
  const body = JSON.stringify({ ...payload, exp: Date.now() + ttlSeconds * 1000 });
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(body, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, ciphertext, tag].map((b) => b.toString('base64url')).join('.');
}

/**
 * Verifica y descifra un token. Devuelve el payload si es valido y no vencio,
 * o null si es invalido, fue alterado o expiro.
 */
function verify(token) {
  try {
    const [ivB, ctB, tagB] = String(token).split('.');
    if (!ivB || !ctB || !tagB) return null;

    const iv = Buffer.from(ivB, 'base64url');
    const ciphertext = Buffer.from(ctB, 'base64url');
    const tag = Buffer.from(tagB, 'base64url');

    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');

    const body = JSON.parse(plain);
    if (!body.exp || Date.now() > body.exp) return null;
    return body;
  } catch (_) {
    return null;
  }
}

module.exports = { sign, verify };
