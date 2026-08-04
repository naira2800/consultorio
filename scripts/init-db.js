'use strict';

/**
 * Crea las tablas (y opcionalmente datos de ejemplo) en la base configurada.
 * Funciona tanto con una base LOCAL (la crea si no existe) como con una base
 * REMOTA ya provista por un proveedor en la nube (donde no se puede crear la
 * base, solo usar la que te dieron).
 *
 * Uso: npm run db:init  [--seed]
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('../src/config/env');

/**
 * Quita las lineas "CREATE DATABASE ..." y "USE ..." de un .sql, para poder
 * ejecutarlo sobre una base ya seleccionada (necesario en hosts remotos, donde
 * la base ya existe y tiene otro nombre).
 */
function stripDbStatements(sql) {
  return sql
    // Quita el statement completo CREATE DATABASE ... ; (puede ocupar varias
    // lineas, ej. con CHARACTER SET / COLLATE antes del punto y coma).
    .replace(/CREATE\s+DATABASE[\s\S]*?;/gi, '')
    // Quita USE nombre_de_base;
    .replace(/^\s*USE\s+\S+\s*;\s*$/gim, '');
}

const sslOption = env.db.ssl ? { ssl: env.db.ssl } : {};

async function run() {
  const withSeed = process.argv.includes('--seed');

  // 1) Intentar crear la base (solo funciona en local; en remoto se ignora).
  try {
    const admin = await mysql.createConnection({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      multipleStatements: true,
      ...sslOption,
    });
    await admin.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.db.database}\` ` +
        `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await admin.end();
    console.log(`[init-db] Base "${env.db.database}" lista.`);
  } catch (err) {
    console.log(
      `[init-db] No se pudo crear la base (normal en hosts remotos): ${err.message}`
    );
    console.log('[init-db] Se usara la base ya existente indicada en DB_NAME.');
  }

  // 2) Conectar YA a la base y crear las tablas dentro de ella.
  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    multipleStatements: true,
    ...sslOption,
  });

  try {
    const schema = stripDbStatements(
      fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8')
    );
    await conn.query(schema);
    console.log('[init-db] Tablas creadas correctamente.');

    if (withSeed) {
      const seed = stripDbStatements(
        fs.readFileSync(path.join(__dirname, '..', 'db', 'seed.sql'), 'utf8')
      );
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
