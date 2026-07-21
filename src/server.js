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
    const detail = err.code ? `${err.code} - ${err.message || 'sin mensaje'}` : err.message;
    console.error(`[DB] No se pudo conectar a MySQL (${env.db.user}@${env.db.host}:${env.db.port}/${env.db.database}):`);
    console.error(`     ${detail}`);
    if (err.code === 'ECONNREFUSED') {
      console.error('     El servidor MySQL no esta escuchando en ese host/puerto. ¿Esta iniciado?');
      console.error('     En un Codespace/contenedor puede levantarlo con: docker compose up -d db');
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('     Usuario o contrasena incorrectos. Revise DB_USER y DB_PASSWORD en su .env');
    } else if (err.code === 'ER_BAD_DB_ERROR') {
      console.error('     La base no existe. Ejecute: npm run db:init -- --seed');
    }
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
