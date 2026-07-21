'use strict';

const cron = require('node-cron');
const env = require('../config/env');
const reportService = require('../services/reportService');

/**
 * Programa el envio automatico del reporte de turnos del dia siguiente.
 * La expresion cron y los canales se configuran por variables de entorno.
 */
function scheduleDailyReport() {
  if (!cron.validate(env.report.cron)) {
    console.error(`[Job] Expresion cron invalida: "${env.report.cron}". No se programa el reporte.`);
    return null;
  }

  const task = cron.schedule(
    env.report.cron,
    async () => {
      console.log('[Job] Ejecutando reporte diario de turnos...');
      try {
        await reportService.sendTomorrowReport();
      } catch (err) {
        console.error('[Job] Error al generar el reporte diario:', err.message);
      }
    },
    { timezone: env.tz }
  );

  console.log(
    `[Job] Reporte diario programado con cron "${env.report.cron}" (TZ: ${env.tz}), ` +
      `canales: ${env.report.channels.join(', ')}.`
  );
  return task;
}

module.exports = { scheduleDailyReport };
