'use strict';

const env = require('../config/env');
const whatsapp = require('./whatsappService');
const { formatDateTime, buildUrl } = require('../utils/format');

/**
 * Envia una notificacion PROACTIVA (que inicia el sistema, fuera de la ventana
 * de 24 hs). Si hay un template configurado y el proveedor es "cloud", se envia
 * como template (unica forma de que Meta lo entregue); si no, cae a texto libre
 * (que solo se entrega dentro de la ventana de 24 hs, util para pruebas/log).
 *
 * El template debe tener 3 variables en el cuerpo:
 *   {{1}} = nombre del destinatario
 *   {{2}} = mensaje (una sola linea)
 *   {{3}} = enlace
 *
 * @param {string} to       destinatario en E.164
 * @param {object} parts     { name, message, link }
 * @param {string} freeform  texto alternativo para el modo sin template
 */
async function sendProactive(to, { name, message, link }, freeform) {
  const useTemplate =
    env.whatsapp.provider === 'cloud' && !!env.whatsapp.cloud.templateName;

  if (useTemplate) {
    return whatsapp.sendTemplate(to, {
      name: env.whatsapp.cloud.templateName,
      languageCode: env.whatsapp.cloud.templateLang,
      bodyParams: [name || '', message || '', link || ''],
    });
  }
  return whatsapp.sendMessage(to, freeform);
}

/**
 * Mensaje de bienvenida automatico que recibe el paciente al escribir por
 * primera vez al WhatsApp del consultorio (paso 1 del flujo).
 * Es una RESPUESTA dentro de la ventana de 24 hs, por eso va como texto libre.
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
 * para revisar los datos del paciente y la orden medica. Es proactivo -> template.
 */
async function notifyProfessionalNewRequest(professional, request) {
  const reviewUrl = buildUrl(`/profesional/solicitud/${request.token}`);
  const freeform =
    `Nuevo ingreso de paciente para ${professional.full_name}.\n` +
    `Revise los datos y la orden medica aqui:\n${reviewUrl}`;
  const results = [];
  if (professional.phone) {
    results.push(
      await sendProactive(
        professional.phone,
        {
          name: professional.full_name,
          message: 'Ingreso una nueva solicitud de paciente para revisar.',
          link: reviewUrl,
        },
        freeform
      )
    );
  }
  return results;
}

/**
 * Paso 4: el profesional habilito horarios; se envia al paciente un link con la
 * grilla de horarios disponibles para que elija. Proactivo -> template.
 */
async function sendSlotsLinkToPatient(patientPhone, requestToken, patientName = 'paciente') {
  const slotsUrl = buildUrl(`/turnos/elegir/${requestToken}`);
  const freeform =
    'El profesional reviso su solicitud. Elija el horario que prefiera en el ' +
    `siguiente link:\n${slotsUrl}`;
  return sendProactive(
    patientPhone,
    {
      name: patientName,
      message: 'El profesional reviso su solicitud, ya puede elegir su horario.',
      link: slotsUrl,
    },
    freeform
  );
}

/**
 * Confirmacion de turno al paciente, con link para cambiar o anular.
 * Proactivo (el paciente eligio en la web, no por WhatsApp) -> template.
 */
async function sendAppointmentConfirmation(appointment, patientPhone, patientName = 'paciente') {
  const manageUrl = buildUrl(`/turnos/gestionar/${appointment.manage_token}`);
  const whenText = formatDateTime(appointment.starts_at);
  const freeform =
    `Turno confirmado para el ${whenText}.\n` +
    `Para cambiarlo o anularlo (hasta 24 hs antes): ${manageUrl}`;
  return sendProactive(
    patientPhone,
    {
      name: patientName,
      message: `Su turno quedo confirmado para el ${whenText}.`,
      link: manageUrl,
    },
    freeform
  );
}

async function sendAppointmentCancelled(patientPhone, startsAt, patientName = 'paciente') {
  const whenText = formatDateTime(startsAt);
  const freeform =
    `Su turno del ${whenText} fue anulado correctamente. ` +
    'Si lo desea puede solicitar uno nuevo escribiendonos por WhatsApp.';
  return sendProactive(
    patientPhone,
    {
      name: patientName,
      message: `Su turno del ${whenText} fue anulado correctamente.`,
      link: buildUrl('/'),
    },
    freeform
  );
}

module.exports = {
  welcomeMessage,
  sendWelcome,
  notifyProfessionalNewRequest,
  sendSlotsLinkToPatient,
  sendAppointmentConfirmation,
  sendAppointmentCancelled,
};
