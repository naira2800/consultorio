'use strict';

/**
 * Crea la base de datos y las tablas ejecutando db/schema.sql.
 * Opcionalmente carga datos de ejemplo (db/seed.sql) con: node scripts/init-db.js --seed
 *
 * Uso: npm run db:init  [--seed]
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('../src/config/env');

async function run() {
  const withSeed = process.argv.includes('--seed');

  // Conectar sin base seleccionada para poder crearla; multipleStatements para el .sql
  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true,
  });

  try {
    const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
    await conn.query(schema);
    console.log('[init-db] Esquema creado correctamente.');

    if (withSeed) {
      const seed = fs.readFileSync(path.join(__dirname, '..', 'db', 'seed.sql'), 'utf8');
      await conn.query(seed);
      console.log('[init-db] Datos de ejemplo cargados.');
    }
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('[init-db] Error:', err.message);
  process.exit(1);
});
