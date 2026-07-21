'use strict';

const whatsapp = require('./whatsappService');
const { formatDateTime, buildUrl } = require('../utils/format');

/**
 * Mensaje de bienvenida automatico que recibe el paciente al escribir por
 * primera vez al WhatsApp del consultorio (paso 1 del flujo).
 */
function welcomeMessage() {
  const formUrl = buildUrl('/formulario');
  return (
    'Complete los datos en el formulario y el profesional seleccionado lo ' +
    'contactara dentro de las 48 hs. Muchas gracias!\n\n' +
    `Formulario: ${formUrl}`
  );
}

async function sendWelcome(patientPhone) {
  return whatsapp.sendMessage(patientPhone, welcomeMessage());
}

/**
 * Paso 3: notifica al profesional que ingreso una nueva solicitud, con un link
 * para revisar los datos del paciente y la orden medica.
 */
async function notifyProfessionalNewRequest(professional, request) {
  const reviewUrl = buildUrl(`/profesional/solicitud/${request.token}`);
  const body =
    `Nuevo ingreso de paciente para ${professional.full_name}.\n` +
    `Revise los datos y la orden medica aqui:\n${reviewUrl}`;
  const results = [];
  if (professional.phone) {
    results.push(await whatsapp.sendMessage(professional.phone, body));
  }
  return results;
}

/**
 * Paso 4: el profesional habilito horarios; se envia al paciente un link con la
 * grilla de horarios disponibles para que elija.
 */
async function sendSlotsLinkToPatient(patientPhone, requestToken) {
  const slotsUrl = buildUrl(`/turnos/elegir/${requestToken}`);
  const body =
    'El profesional reviso su solicitud. Elija el horario que prefiera en el ' +
    `siguiente link:\n${slotsUrl}`;
  return whatsapp.sendMessage(patientPhone, body);
}

/**
 * Confirmacion de turno al paciente, con link para cambiar o anular.
 */
async function sendAppointmentConfirmation(appointment, patientPhone) {
  const manageUrl = buildUrl(`/turnos/gestionar/${appointment.manage_token}`);
  const body =
    `Turno confirmado para el ${formatDateTime(appointment.starts_at)}.\n` +
    `Para cambiarlo o anularlo (hasta 24 hs antes): ${manageUrl}`;
  return whatsapp.sendMessage(patientPhone, body);
}

async function sendAppointmentCancelled(patientPhone, startsAt) {
  const body =
    `Su turno del ${formatDateTime(startsAt)} fue anulado correctamente. ` +
    'Si lo desea puede solicitar uno nuevo escribiendonos por WhatsApp.';
  return whatsapp.sendMessage(patientPhone, body);
}

module.exports = {
  welcomeMessage,
  sendWelcome,
  notifyProfessionalNewRequest,
  sendSlotsLinkToPatient,
  sendAppointmentConfirmation,
  sendAppointmentCancelled,
};
