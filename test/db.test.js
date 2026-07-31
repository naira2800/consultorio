'use strict';

/**
 * Prueba de integracion contra MySQL.
 * Solo se ejecuta cuando hay una base disponible (variable DB_HOST definida),
 * como ocurre en el workflow de CI. En local sin base, la prueba se omite.
 *
 * Verifica que la conexion responda y que el esquema (db/schema.sql) haya
 * creado las tablas esperadas.
 */

const test = require('node:test');
const assert = require('node:assert');

const hasDb = Boolean(process.env.DB_HOST);

test(
  'la conexion a MySQL responde y el esquema tiene tablas',
  { skip: hasDb ? false : 'DB_HOST no definido; se omite la prueba de base de datos' },
  async () => {
    const { pool, assertConnection } = require('../src/config/db');
    try {
      await assertConnection();

      const dbName = process.env.DB_NAME || 'consultorio';
      const [rows] = await pool.query(
        'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ?',
        [dbName],
      );
      assert.ok(rows[0].n > 0, 'el esquema deberia haber creado al menos una tabla');
    } finally {
      await pool.end();
    }
  },
);
