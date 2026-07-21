'use strict';

/**
 * Ejecuta manualmente el reporte de turnos del dia siguiente y termina.
 * Util para pruebas o para invocarlo desde un cron externo del sistema.
 *
 * Uso: npm run report:daily
 */

const reportService = require('../src/services/reportService');
const { pool } = require('../src/config/db');

reportService
  .sendTomorrowReport()
  .then((summary) => {
    console.log('[report] Resumen:', JSON.stringify(summary, null, 2));
  })
  .catch((err) => {
    console.error('[report] Error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
