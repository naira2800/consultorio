'use strict';

const ProfessionalModel = require('../models/professionalModel');
const PatientModel = require('../models/patientModel');
const RequestModel = require('../models/requestModel');
const notificationService = require('../services/notificationService');
const token = require('../utils/token');

/**
 * Reconoce a un paciente a partir del token de acceso passwordless (?t=).
 * Devuelve el paciente si el token es valido, no vencio y existe en la base;
 * o { phone } si el telefono esta verificado pero aun no hay registro.
 */
async function resolveKnownPatient(req) {
  const t = req.query.t;
  if (!t) return null;
  const data = token.verify(t);
  if (!data || !data.phone) return null;
  const patient = await PatientModel.findByPhone(data.phone);
  return patient || { phone: data.phone };
}

/**
 * Paso 1/2: muestra el formulario para que el paciente complete sus datos.
 * Pregunta primero si es paciente nuevo o existente, y permite elegir profesional.
 *
 * Si llega con un token valido (?t=), reconoce al paciente y precarga sus datos
 * para que no tenga que volver a escribirlos ni loguearse.
 */
async function showForm(req, res, next) {
  try {
    const professionals = await ProfessionalModel.findAllActive();
    const known = await resolveKnownPatient(req);
    res.render('form', {
      professionals,
      known,
      accessToken: req.query.t || '',
      prefillPhone: (known && known.phone) || req.query.phone || '',
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
      const known = phone ? await PatientModel.findByPhone(phone) : null;
      return res.status(400).render('form', {
        professionals,
        known,
        accessToken: req.body.access_token || '',
        prefillPhone: phone || '',
        error: 'Complete su nombre, su teléfono y seleccione un profesional.',
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
