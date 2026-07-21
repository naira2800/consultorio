'use strict';

const RequestModel = require('../models/requestModel');
const SlotModel = require('../models/slotModel');
const AppointmentModel = require('../models/appointmentModel');
const PatientModel = require('../models/patientModel');
const notificationService = require('../services/notificationService');
const { formatDateTime } = require('../utils/format');

/**
 * Paso 4: el paciente abre el link y ve la grilla de horarios disponibles del
 * profesional para elegir uno.
 */
async function showSlots(req, res, next) {
  try {
    const request = await RequestModel.findByTokenDetailed(req.params.token);
    if (!request) {
      return res.status(404).render('error', { message: 'Solicitud no encontrada.' });
    }
    if (request.status === 'scheduled') {
      return res.render('error', {
        message: 'Esta solicitud ya tiene un turno asignado.',
      });
    }

    const slots = await SlotModel.findAvailableByProfessional(request.professional_id);
    res.render('patient-slots', { request, slots, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * El paciente confirma un horario -> se crea el turno de forma atomica.
 */
async function bookSlot(req, res, next) {
  try {
    const request = await RequestModel.findByTokenDetailed(req.params.token);
    if (!request) {
      return res.status(404).render('error', { message: 'Solicitud no encontrada.' });
    }

    const slotId = parseInt(req.body.slot_id, 10);
    if (!slotId) {
      const slots = await SlotModel.findAvailableByProfessional(request.professional_id);
      return res.status(400).render('patient-slots', {
        request,
        slots,
        error: 'Seleccione un horario.',
      });
    }

    let appointment;
    try {
      appointment = await AppointmentModel.book({
        patient_id: request.patient_id,
        professional_id: request.professional_id,
        slot_id: slotId,
        request_id: request.id,
      });
    } catch (err) {
      if (err.code === 'SLOT_TAKEN') {
        const slots = await SlotModel.findAvailableByProfessional(request.professional_id);
        return res.status(409).render('patient-slots', {
          request,
          slots,
          error: err.message,
        });
      }
      throw err;
    }

    await RequestModel.markScheduled(request.id);

    const patient = await PatientModel.findById(request.patient_id);
    await notificationService.sendAppointmentConfirmation(appointment, patient.phone);

    res.render('patient-confirmed', {
      appointment,
      whenText: formatDateTime(appointment.starts_at),
      manageToken: appointment.manage_token,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Requisito 3: pagina de gestion del turno (cambiar/anular), accesible con el
 * manage_token. Muestra si aun esta dentro de la ventana de 24 hs.
 */
async function manage(req, res, next) {
  try {
    const appt = await AppointmentModel.findByManageTokenDetailed(req.params.token);
    if (!appt) {
      return res.status(404).render('error', { message: 'Turno no encontrado.' });
    }

    const hoursUntil = (new Date(appt.starts_at).getTime() - Date.now()) / 3600000;
    const canModify = appt.status === 'confirmed' && hoursUntil >= 24;

    let slots = [];
    if (canModify) {
      slots = await SlotModel.findAvailableByProfessional(appt.professional_id);
    }

    res.render('patient-manage', {
      appt,
      canModify,
      hoursUntil: Math.floor(hoursUntil),
      slots,
      whenText: formatDateTime(appt.starts_at),
      message: null,
    });
  } catch (err) {
    next(err);
  }
}

async function cancel(req, res, next) {
  try {
    const appt = await AppointmentModel.findByManageTokenDetailed(req.params.token);
    if (!appt) {
      return res.status(404).render('error', { message: 'Turno no encontrado.' });
    }

    try {
      await AppointmentModel.cancel(appt.id);
    } catch (err) {
      if (err.code === 'TOO_LATE' || err.code === 'NOT_ACTIVE') {
        return renderManage(res, appt, err.message);
      }
      throw err;
    }

    await notificationService.sendAppointmentCancelled(appt.patient_phone, appt.starts_at);

    res.render('patient-manage', {
      appt: { ...appt, status: 'cancelled' },
      canModify: false,
      hoursUntil: 0,
      slots: [],
      whenText: formatDateTime(appt.starts_at),
      message: 'Su turno fue anulado correctamente.',
    });
  } catch (err) {
    next(err);
  }
}

async function reschedule(req, res, next) {
  try {
    const appt = await AppointmentModel.findByManageTokenDetailed(req.params.token);
    if (!appt) {
      return res.status(404).render('error', { message: 'Turno no encontrado.' });
    }

    const newSlotId = parseInt(req.body.slot_id, 10);
    if (!newSlotId) {
      return renderManage(res, appt, 'Seleccione un nuevo horario.');
    }

    let newAppt;
    try {
      newAppt = await AppointmentModel.reschedule(appt.id, newSlotId);
    } catch (err) {
      if (['TOO_LATE', 'NOT_ACTIVE', 'SLOT_TAKEN'].includes(err.code)) {
        return renderManage(res, appt, err.message);
      }
      throw err;
    }

    await notificationService.sendAppointmentConfirmation(newAppt, appt.patient_phone);

    res.render('patient-confirmed', {
      appointment: newAppt,
      whenText: formatDateTime(newAppt.starts_at),
      manageToken: newAppt.manage_token,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Helper para re-renderizar la pagina de gestion con un mensaje (error o aviso).
 */
async function renderManage(res, appt, message) {
  const hoursUntil = (new Date(appt.starts_at).getTime() - Date.now()) / 3600000;
  const canModify = appt.status === 'confirmed' && hoursUntil >= 24;
  const slots = canModify
    ? await SlotModel.findAvailableByProfessional(appt.professional_id)
    : [];
  return res.status(400).render('patient-manage', {
    appt,
    canModify,
    hoursUntil: Math.floor(hoursUntil),
    slots,
    whenText: formatDateTime(appt.starts_at),
    message,
  });
}

module.exports = { showSlots, bookSlot, manage, cancel, reschedule };
