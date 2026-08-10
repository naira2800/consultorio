'use strict';

const { pool } = require('../config/db');

const PatientModel = {
  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM patients WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async findByPhone(phone) {
    const [rows] = await pool.query('SELECT * FROM patients WHERE phone = ?', [phone]);
    return rows[0] || null;
  },

  async findByDni(dni) {
    if (!dni) return null;
    const [rows] = await pool.query('SELECT * FROM patients WHERE dni = ?', [dni]);
    return rows[0] || null;
  },

  /**
   * Crea el paciente o actualiza sus datos si ya existe.
   * Identidad del paciente: prioriza el DNI (estable, no cambia de titular);
   * si no vino DNI (es opcional en el formulario), usa el telefono como
   * respaldo para no duplicar al paciente. El telefono SI se actualiza en
   * cada envio, para que un cambio de numero quede reflejado.
   * Cumple el requisito de "Registro de Usuarios".
   */
  async upsert({ full_name, dni, phone, email, health_insurance, is_new }) {
    const existing = (dni && (await this.findByDni(dni))) || (await this.findByPhone(phone));

    if (existing) {
      await pool.execute(
        `UPDATE patients
            SET full_name = ?, dni = ?, phone = ?, email = ?, health_insurance = ?, is_new = ?
          WHERE id = ?`,
        [
          full_name,
          dni || existing.dni || null,
          phone,
          email || null,
          health_insurance || null,
          is_new ? 1 : 0,
          existing.id,
        ]
      );
      return this.findById(existing.id);
    }

    const [res] = await pool.execute(
      `INSERT INTO patients (full_name, dni, phone, email, health_insurance, is_new)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [full_name, dni || null, phone, email || null, health_insurance || null, is_new ? 1 : 0]
    );
    return this.findById(res.insertId);
  },
};

module.exports = PatientModel;
