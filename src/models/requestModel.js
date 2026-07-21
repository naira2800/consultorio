'use strict';

const crypto = require('crypto');
const { pool } = require('../config/db');

const RequestModel = {
  async create({ patient_id, professional_id, reason, medical_order_file }) {
    const token = crypto.randomUUID();
    const [res] = await pool.execute(
      `INSERT INTO requests (patient_id, professional_id, reason, medical_order_file, token)
       VALUES (?, ?, ?, ?, ?)`,
      [patient_id, professional_id, reason || null, medical_order_file || null, token]
    );
    return this.findById(res.insertId);
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM requests WHERE id = ?', [id]);
    return rows[0] || null;
  },

  /**
   * Devuelve la solicitud junto con los datos del paciente y del profesional.
   */
  async findByTokenDetailed(token) {
    const [rows] = await pool.query(
      `SELECT r.*,
              p.full_name  AS patient_name,  p.dni AS patient_dni,
              p.phone      AS patient_phone, p.email AS patient_email,
              p.health_insurance, p.is_new,
              pr.full_name AS professional_name, pr.specialty
         FROM requests r
         JOIN patients p       ON p.id = r.patient_id
         JOIN professionals pr ON pr.id = r.professional_id
        WHERE r.token = ?`,
      [token]
    );
    return rows[0] || null;
  },

  async markReviewed(id) {
    await pool.execute(
      `UPDATE requests
          SET status = 'reviewed', reviewed_at = NOW()
        WHERE id = ? AND status = 'pending'`,
      [id]
    );
  },

  async markScheduled(id) {
    await pool.execute(
      `UPDATE requests SET status = 'scheduled' WHERE id = ?`,
      [id]
    );
  },
};

module.exports = RequestModel;
