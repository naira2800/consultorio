'use strict';

const path = require('path');
const express = require('express');
const routes = require('./routes');
const { UPLOAD_DIR } = require('./middleware/upload');

const app = express();

// Motor de vistas EJS.
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// Parsers: JSON (WhatsApp Cloud API) y urlencoded (formularios y Twilio).
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Archivos estaticos (CSS) y ordenes medicas subidas.
app.use('/public', express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

// Rutas de la aplicacion.
app.use('/', routes);

// 404
app.use((req, res) => {
  res.status(404).render('error', { message: 'Pagina no encontrada.' });
});

// Manejador de errores central.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  const status = err.status || 500;
  res.status(status).render('error', {
    message: err.message || 'Ocurrio un error inesperado.',
  });
});

module.exports = app;
