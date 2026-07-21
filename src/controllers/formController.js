'use strict';

const ProfessionalModel = require('../models/professionalModel');
const PatientModel = require('../models/patientModel');
const RequestModel = require('../models/requestModel');
const notificationService = require('../services/notificationService');

/**
 * Paso 1/2: muestra el formulario para que el paciente complete sus datos.
 * Pregunta primero si es paciente nuevo o existente, y permite elegir profesional.
 * Acepta ?phone= para precargar el telefono provisto por el webhook de WhatsApp.
 */
async function showForm(req, res, next) {
  try {
    const professionals = await ProfessionalModel.findAllActive();
    res.render('form', {
      professionals,
      prefillPhone: req.query.phone || '',
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Paso 2/3: procesa el envio del formulario, crea (o actualiza) el paciente y la
 * solicitud, guarda la orden medica adjunta y notifica al profesional.
 */
async function submitForm(req, res, next) {
  try {
    const {
      patient_type,
      full_name,
      dni,
      phone,
      email,
      health_insurance,
      professional_id,
      reason,
    } = req.body;

    // Validacion basica.
    const professional = await ProfessionalModel.findById(professional_id);
    if (!full_name || !phone || !professional) {
      const professionals = await ProfessionalModel.findAllActive();
      return res.status(400).render('form', {
        professionals,
        prefillPhone: phone || '',
        error: 'Complete nombre, telefono y seleccione un profesional valido.',
      });
    }

    const patient = await PatientModel.upsert({
      full_name,
      dni,
      phone,
      email,
      health_insurance,
      is_new: patient_type !== 'existente',
    });

    const medicalOrderFile = req.file ? req.file.filename : null;

    const request = await RequestModel.create({
      patient_id: patient.id,
      professional_id: professional.id,
      reason,
      medical_order_file: medicalOrderFile,
    });

    // Paso 3: notificar al profesional por WhatsApp.
    await notificationService.notifyProfessionalNewRequest(professional, request);

    res.render('form-success', {
      patientName: patient.full_name,
      professionalName: professional.full_name,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { showForm, submitForm };
