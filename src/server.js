'use strict';

const app = require('./app');
const env = require('./config/env');
const { assertConnection } = require('./config/db');
const { scheduleDailyReport } = require('./jobs/dailyReportJob');

async function start() {
  // Verificar la base de datos antes de levantar el servidor.
  try {
    await assertConnection();
    console.log(`[DB] Conectado a MySQL "${env.db.database}" en ${env.db.host}:${env.db.port}.`);
  } catch (err) {
    console.error('[DB] No se pudo conectar a MySQL:', err.message);
    console.error('     Verifique las variables DB_* en su archivo .env y que MySQL este activo.');
    process.exit(1);
  }

  // Programar el reporte diario de turnos.
  scheduleDailyReport();

  app.listen(env.port, () => {
    console.log(`[Server] Consultorio escuchando en ${env.baseUrl} (puerto ${env.port}).`);
  });
}

start();
