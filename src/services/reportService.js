'use strict';

const AppointmentModel = require('../models/appointmentModel');
const ProfessionalModel = require('../models/professionalModel');
const emailService = require('./emailService');
const whatsapp = require('./whatsappService');
const env = require('../config/env');
const { formatTime, formatDate } = require('../utils/format');

/**
 * Calcula el rango [inicio, fin) del dia siguiente en hora local.
 */
function tomorrowRange(reference = new Date()) {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/**
 * Agrupa los turnos confirmados del dia siguiente por profesional.
 * @returns {Map<number, {professional, appointments: []}>}
 */
async function buildTomorrowReport(reference = new Date()) {
  const { start, end } = tomorrowRange(reference);
  const rows = await AppointmentModel.findConfirmedBetween(start, end);

  const byProfessional = new Map();
  for (const row of rows) {
    if (!byProfessional.has(row.professional_id)) {
      byProfessional.set(row.professional_id, {
        professional: {
          id: row.professional_id,
          full_name: row.professional_name,
          email: row.professional_email,
          phone: row.professional_phone,
          specialty: row.specialty,
        },
        appointments: [],
      });
    }
    byProfessional.get(row.professional_id).appointments.push(row);
  }

  return { date: start, groups: byProfessional };
}

function renderText(group, date) {
  const lines = [
    `Turnos para el ${formatDate(date)}`,
    `Profesional: ${group.professional.full_name}`,
    '--------------------------------------',
  ];
  group.appointments.forEach((a, i) => {
    lines.push(
      `${i + 1}. ${formatTime(a.starts_at)} - ${a.patient_name} ` +
        `(${a.patient_phone}${a.health_insurance ? ', ' + a.health_insurance : ''})`
    );
  });
  lines.push('--------------------------------------');
  lines.push(`Total: ${group.appointments.length} turno(s).`);
  return lines.join('\n');
}

function renderHtml(group, date) {
  const rows = group.appointments
    .map(
      (a, i) => `<tr>
        <td style="padding:6px 10px;border:1px solid #ddd;">${i + 1}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;">${formatTime(a.starts_at)}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;">${escapeHtml(a.patient_name)}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;">${escapeHtml(a.patient_phone)}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;">${escapeHtml(a.health_insurance || '-')}</td>
      </tr>`
    )
    .join('');

  return `<div style="font-family:Arial,sans-serif;color:#222;">
    <h2>Turnos para el ${formatDate(date)}</h2>
    <p><strong>Profesional:</strong> ${escapeHtml(group.professional.full_name)}
       ${group.professional.specialty ? '(' + escapeHtml(group.professional.specialty) + ')' : ''}</p>
    <table style="border-collapse:collapse;">
      <thead>
        <tr style="background:#f2f2f2;">
          <th style="padding:6px 10px;border:1px solid #ddd;">#</th>
          <th style="padding:6px 10px;border:1px solid #ddd;">Hora</th>
          <th style="padding:6px 10px;border:1px solid #ddd;">Paciente</th>
          <th style="padding:6px 10px;border:1px solid #ddd;">Telefono</th>
          <th style="padding:6px 10px;border:1px solid #ddd;">Obra social</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p>Total: <strong>${group.appointments.length}</strong> turno(s).</p>
  </div>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

/**
 * Genera y envia el reporte del dia siguiente a cada profesional por los canales
 * configurados (email y/o WhatsApp). Cumple el requisito 4.
 * @returns {object} resumen de lo enviado
 */
async function sendTomorrowReport(reference = new Date()) {
  const { date, groups } = await buildTomorrowReport(reference);
  const channels = env.report.channels;
  const summary = { date, professionals: 0, appointments: 0, sent: [] };

  if (groups.size === 0) {
    console.log('[Reporte] No hay turnos para el dia siguiente. Nada que enviar.');
    return summary;
  }

  for (const group of groups.values()) {
    summary.professionals += 1;
    summary.appointments += group.appointments.length;

    const text = renderText(group, date);

    if (channels.includes('email') && group.professional.email) {
      await emailService.sendMail({
        to: group.professional.email,
        subject: `Turnos del ${formatDate(date)} - ${group.professional.full_name}`,
        html: renderHtml(group, date),
        text,
      });
      summary.sent.push({ professional: group.professional.full_name, channel: 'email' });
    }

    if (channels.includes('whatsapp') && group.professional.phone) {
      await whatsapp.sendMessage(group.professional.phone, text);
      summary.sent.push({ professional: group.professional.full_name, channel: 'whatsapp' });
    }
  }

  console.log(
    `[Reporte] Enviado: ${summary.professionals} profesional(es), ` +
      `${summary.appointments} turno(s).`
  );
  return summary;
}

module.exports = { buildTomorrowReport, sendTomorrowReport, tomorrowRange };
