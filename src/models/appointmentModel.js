'use strict';

const crypto = require('crypto');
const { pool } = require('../config/db');

const AppointmentModel = {
  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM appointments WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async findByManageTokenDetailed(token) {
    const [rows] = await pool.query(
      `SELECT a.*,
              p.full_name  AS patient_name,  p.phone AS patient_phone,
              pr.full_name AS professional_name, pr.specialty
         FROM appointments a
         JOIN patients p       ON p.id = a.patient_id
         JOIN professionals pr ON pr.id = a.professional_id
        WHERE a.manage_token = ?`,
      [token]
    );
    return rows[0] || null;
  },

  /**
   * Reserva un turno de forma atomica: valida y marca el slot como ocupado
   * dentro de una transaccion para evitar doble reserva.
   * @returns {object} el turno creado
   * @throws {Error} con code 'SLOT_TAKEN' si el horario ya no esta disponible
   */
  async book({ patient_id, professional_id, slot_id, request_id }) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [slots] = await conn.query(
        `SELECT * FROM slots WHERE id = ? FOR UPDATE`,
        [slot_id]
      );
      const slot = slots[0];
      if (!slot || slot.status !== 'available' || slot.professional_id !== professional_id) {
        const err = new Error('El horario seleccionado ya no esta disponible.');
        err.code = 'SLOT_TAKEN';
        throw err;
      }

      const manageToken = crypto.randomUUID();
      const [res] = await conn.execute(
        `INSERT INTO appointments
           (patient_id, professional_id, slot_id, request_id, starts_at, manage_token)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [patient_id, professional_id, slot_id, request_id || null, slot.starts_at, manageToken]
      );

      await conn.execute(`UPDATE slots SET status = 'booked' WHERE id = ?`, [slot_id]);

      await conn.commit();
      return this.findById(res.insertId);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  /**
   * Anula un turno liberando el horario. Solo permitido con >= 24 hs de anticipacion.
   * @throws {Error} code 'TOO_LATE' si faltan menos de 24 hs.
   */
  async cancel(appointmentId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query(
        `SELECT * FROM appointments WHERE id = ? FOR UPDATE`,
        [appointmentId]
      );
      const appt = rows[0];
      if (!appt || appt.status !== 'confirmed') {
        const err = new Error('El turno no existe o no esta activo.');
        err.code = 'NOT_ACTIVE';
        throw err;
      }
      assertAtLeast24h(appt.starts_at);

      await conn.execute(
        `UPDATE appointments SET status = 'cancelled', cancelled_at = NOW() WHERE id = ?`,
        [appointmentId]
      );
      await conn.execute(`UPDATE slots SET status = 'available' WHERE id = ?`, [appt.slot_id]);

      await conn.commit();
      return { ...appt, status: 'cancelled' };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  /**
   * Reprograma un turno a un nuevo horario. Requiere >= 24 hs de anticipacion
   * respecto del turno actual. Libera el horario viejo y ocupa el nuevo.
   */
  async reschedule(appointmentId, newSlotId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query(
        `SELECT * FROM appointments WHERE id = ? FOR UPDATE`,
        [appointmentId]
      );
      const appt = rows[0];
      if (!appt || appt.status !== 'confirmed') {
        const err = new Error('El turno no existe o no esta activo.');
        err.code = 'NOT_ACTIVE';
        throw err;
      }
      assertAtLeast24h(appt.starts_at);

      const [slots] = await conn.query(
        `SELECT * FROM slots WHERE id = ? FOR UPDATE`,
        [newSlotId]
      );
      const newSlot = slots[0];
      if (
        !newSlot ||
        newSlot.status !== 'available' ||
        newSlot.professional_id !== appt.professional_id
      ) {
        const err = new Error('El nuevo horario ya no esta disponible.');
        err.code = 'SLOT_TAKEN';
        throw err;
      }

      // Marcar el turno actual como reprogramado y liberar su slot.
      await conn.execute(
        `UPDATE appointments SET status = 'rescheduled' WHERE id = ?`,
        [appointmentId]
      );
      await conn.execute(`UPDATE slots SET status = 'available' WHERE id = ?`, [appt.slot_id]);

      // Crear el nuevo turno confirmado y ocupar el nuevo slot.
      const manageToken = crypto.randomUUID();
      const [res] = await conn.execute(
        `INSERT INTO appointments
           (patient_id, professional_id, slot_id, request_id, starts_at, manage_token)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          appt.patient_id,
          appt.professional_id,
          newSlotId,
          appt.request_id,
          newSlot.starts_at,
          manageToken,
        ]
      );
      await conn.execute(`UPDATE slots SET status = 'booked' WHERE id = ?`, [newSlotId]);

      await conn.commit();
      return this.findById(res.insertId);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  /**
   * Turnos confirmados de un dia (rango [dayStart, dayEnd)) agrupados luego por
   * el servicio de reportes. Devuelve filas con datos de paciente y profesional.
   */
  async findConfirmedBetween(dayStart, dayEnd) {
    const [rows] = await pool.query(
      `SELECT a.id, a.starts_at, a.professional_id,
              p.full_name  AS patient_name,  p.phone AS patient_phone,
              p.health_insurance,
              pr.full_name AS professional_name, pr.email AS professional_email,
              pr.phone AS professional_phone, pr.specialty
         FROM appointments a
         JOIN patients p       ON p.id = a.patient_id
         JOIN professionals pr ON pr.id = a.professional_id
        WHERE a.status = 'confirmed'
          AND a.starts_at >= ? AND a.starts_at < ?
        ORDER BY pr.full_name, a.starts_at`,
      [dayStart, dayEnd]
    );
    return rows;
  },
};

/**
 * Regla de negocio central: no se puede cambiar ni anular con menos de 24 hs.
 */
function assertAtLeast24h(startsAt) {
  const start = new Date(startsAt).getTime();
  const now = Date.now();
  const hours = (start - now) / (1000 * 60 * 60);
  if (hours < 24) {
    const err = new Error(
      'Los turnos solo pueden cambiarse o anularse con al menos 24 horas de anticipacion.'
    );
    err.code = 'TOO_LATE';
    throw err;
  }
}

module.exports = AppointmentModel;
