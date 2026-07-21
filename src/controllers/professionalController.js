'use strict';

const RequestModel = require('../models/requestModel');
const PatientModel = require('../models/patientModel');
const notificationService = require('../services/notificationService');

/**
 * Paso 3: el profesional abre el link recibido por WhatsApp y revisa los datos
 * del paciente y la orden medica adjunta.
 */
async function showRequest(req, res, next) {
  try {
    const request = await RequestModel.findByTokenDetailed(req.params.token);
    if (!request) {
      return res.status(404).render('error', { message: 'Solicitud no encontrada.' });
    }
    res.render('professional-request', { request });
  } catch (err) {
    next(err);
  }
}

/**
 * Paso 4: el profesional habilita el envio de horarios; el sistema envia al
 * paciente un link con la grilla de horarios disponibles.
 */
async function enableSlots(req, res, next) {
  try {
    const request = await RequestModel.findByTokenDetailed(req.params.token);
    if (!request) {
      return res.status(404).render('error', { message: 'Solicitud no encontrada.' });
    }

    await RequestModel.markReviewed(request.id);

    const patient = await PatientModel.findById(request.patient_id);
    await notificationService.sendSlotsLinkToPatient(patient.phone, request.token);

    res.render('professional-sent', {
      patientName: request.patient_name,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { showRequest, enableSlots };
