'use strict';

/**
 * Prueba de humo de la aplicacion HTTP.
 * Levanta el servidor Express en un puerto libre y verifica que la pagina de
 * inicio responda 200. No requiere base de datos (la ruta "/" no consulta MySQL).
 */

const test = require('node:test');
const assert = require('node:assert');
const app = require('../src/app');

test('GET / responde 200 y renderiza la home', async () => {
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/`);
    assert.strictEqual(res.status, 200, 'la home deberia responder 200');
    const body = await res.text();
    assert.ok(body.length > 0, 'la home deberia devolver contenido');
  } finally {
    server.close();
  }
});

test('una ruta inexistente responde 404', async () => {
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/no-existe-esta-ruta`);
    assert.strictEqual(res.status, 404, 'una ruta desconocida deberia responder 404');
  } finally {
    server.close();
  }
});
