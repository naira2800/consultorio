'use strict';

const express = require('express');
const router = express.Router();

const { upload } = require('../middleware/upload');
const whatsappController = require('../controllers/whatsappController');
const formController = require('../controllers/formController');
const professionalController = require('../controllers/professionalController');
const appointmentController = require('../controllers/appointmentController');
const reportService = require('../services/reportService');

// -------- Pagina de inicio --------
router.get('/', (req, res) => {
  res.render('home');
});

// -------- Webhook de WhatsApp (paso 1) --------
// Verificacion (WhatsApp Cloud API) y recepcion de mensajes entrantes.
router.get('/webhook/whatsapp', whatsappController.verifyCloudWebhook);
router.post('/webhook/whatsapp', whatsappController.handleIncoming);

// -------- Formulario del paciente (pasos 1 y 2) --------
router.get('/formulario', formController.showForm);
router.post('/formulario', upload.single('medical_order'), formController.submitForm);

// -------- Vista del profesional (pasos 3 y 4) --------
router.get('/profesional/solicitud/:token', professionalController.showRequest);
router.post('/profesional/solicitud/:token/habilitar', professionalController.enableSlots);

// -------- Eleccion de horario por el paciente (paso 4) --------
router.get('/turnos/elegir/:token', appointmentController.showSlots);
router.post('/turnos/elegir/:token', appointmentController.bookSlot);

// -------- Gestion del turno: cambiar / anular (requisito 3) --------
router.get('/turnos/gestionar/:token', appointmentController.manage);
router.post('/turnos/gestionar/:token/anular', appointmentController.cancel);
router.post('/turnos/gestionar/:token/reprogramar', appointmentController.reschedule);

// -------- Disparo manual del reporte del dia siguiente (requisito 4) --------
// Util para pruebas: ejecuta el mismo envio que el job programado.
router.post('/admin/reporte-diario', async (req, res, next) => {
  try {
    const summary = await reportService.sendTomorrowReport();
    res.json({ ok: true, summary });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
