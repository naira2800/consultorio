'use strict';

const env = require('../config/env');

/**
 * Formatea una fecha/hora para mostrar al usuario en espanol.
 * ej: "martes 22/07/2026 09:30"
 */
function formatDateTime(value) {
  const d = new Date(value);
  const fmt = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: env.tz,
  });
  return fmt.format(d);
}

function formatTime(value) {
  const d = new Date(value);
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: env.tz,
  }).format(d);
}

function formatDate(value) {
  const d = new Date(value);
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: env.tz,
  }).format(d);
}

/**
 * Construye una URL absoluta a partir de un path relativo, usando APP_BASE_URL.
 */
function buildUrl(path) {
  const base = env.baseUrl.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

module.exports = { formatDateTime, formatTime, formatDate, buildUrl };
