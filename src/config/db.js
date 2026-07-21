'use strict';

const mysql = require('mysql2/promise');
const env = require('./env');

/**
 * Pool de conexiones MySQL compartido por toda la aplicacion.
 * Usar `pool.query(...)` o `pool.execute(...)` desde los modelos.
 */
const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: 'local',
  dateStrings: false,
});

/**
 * Verifica que la conexion a la base este disponible al iniciar.
 */
async function assertConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

module.exports = { pool, assertConnection };
