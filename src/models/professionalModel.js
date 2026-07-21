'use strict';

const { pool } = require('../config/db');

const ProfessionalModel = {
  async findAllActive() {
    const [rows] = await pool.query(
      'SELECT * FROM professionals WHERE active = 1 ORDER BY full_name'
    );
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM professionals WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async create({ full_name, specialty, email, phone }) {
    const [res] = await pool.execute(
      `INSERT INTO professionals (full_name, specialty, email, phone)
       VALUES (?, ?, ?, ?)`,
      [full_name, specialty || null, email || null, phone || null]
    );
    return this.findById(res.insertId);
  },
};

module.exports = ProfessionalModel;
