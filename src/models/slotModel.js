'use strict';

const { pool } = require('../config/db');

const SlotModel = {
  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM slots WHERE id = ?', [id]);
    return rows[0] || null;
  },

  /**
   * Horarios disponibles a futuro para un profesional.
   */
  async findAvailableByProfessional(professionalId) {
    const [rows] = await pool.query(
      `SELECT * FROM slots
        WHERE professional_id = ?
          AND status = 'available'
          AND starts_at > NOW()
        ORDER BY starts_at`,
      [professionalId]
    );
    return rows;
  },

  async create({ professional_id, starts_at, duration_min }) {
    const [res] = await pool.execute(
      `INSERT INTO slots (professional_id, starts_at, duration_min)
       VALUES (?, ?, ?)`,
      [professional_id, starts_at, duration_min || 30]
    );
    return this.findById(res.insertId);
  },

  async markBooked(id, conn = pool) {
    await conn.execute(`UPDATE slots SET status = 'booked' WHERE id = ?`, [id]);
  },

  async markAvailable(id, conn = pool) {
    await conn.execute(`UPDATE slots SET status = 'available' WHERE id = ?`, [id]);
  },
};

module.exports = SlotModel;
