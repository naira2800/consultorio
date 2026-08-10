-- ==========================================================================
-- Esquema de base de datos - Gestion de turnos del consultorio medico
-- Motor: MySQL 8+
-- ==========================================================================

CREATE DATABASE IF NOT EXISTS consultorio
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE consultorio;

-- --------------------------------------------------------------------------
-- Profesionales que atienden en el consultorio
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS professionals (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(150)  NOT NULL,
  specialty     VARCHAR(120)  NULL,
  email         VARCHAR(150)  NULL,
  -- Numero de WhatsApp en formato E.164, ej: +5491122334455
  phone         VARCHAR(30)   NULL,
  active        TINYINT(1)    NOT NULL DEFAULT 1,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_prof_email (email)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- Pacientes (registro de usuarios)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(150)  NOT NULL,
  -- Identidad estable del paciente (no cambia de titular como el telefono).
  -- Opcional en el formulario, por eso NULL; unico cuando esta presente.
  dni           VARCHAR(20)   NULL,
  -- Numero de WhatsApp en formato E.164. NO es unico: puede reciclarse a
  -- otro titular con el tiempo, por eso la identidad se basa en el DNI.
  phone         VARCHAR(30)   NOT NULL,
  email         VARCHAR(150)  NULL,
  health_insurance VARCHAR(120) NULL,        -- obra social / prepaga
  is_new        TINYINT(1)    NOT NULL DEFAULT 1,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_patient_dni (dni)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- Solicitudes de atencion enviadas desde el formulario web
-- (paso previo a la asignacion de un turno concreto)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS requests (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  patient_id       INT           NOT NULL,
  professional_id  INT           NOT NULL,
  reason           TEXT          NULL,        -- motivo de consulta
  medical_order_file VARCHAR(255) NULL,       -- ruta del archivo adjunto (orden medica)
  -- pending: recien ingresada | reviewed: el profesional la reviso y ofrecio horarios
  -- scheduled: el paciente eligio turno | cancelled: descartada
  status           ENUM('pending','reviewed','scheduled','cancelled')
                   NOT NULL DEFAULT 'pending',
  -- Token unico usado en los links de WhatsApp (revisar / elegir horario)
  token            CHAR(36)      NOT NULL,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at      TIMESTAMP     NULL,
  CONSTRAINT fk_req_patient      FOREIGN KEY (patient_id)      REFERENCES patients(id),
  CONSTRAINT fk_req_professional FOREIGN KEY (professional_id) REFERENCES professionals(id),
  UNIQUE KEY uq_req_token (token),
  INDEX idx_req_status (status)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- Horarios disponibles (slots) que ofrece cada profesional
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS slots (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  professional_id  INT           NOT NULL,
  starts_at        DATETIME      NOT NULL,
  duration_min     INT           NOT NULL DEFAULT 30,
  -- available: libre | booked: reservado
  status           ENUM('available','booked') NOT NULL DEFAULT 'available',
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_slot_professional FOREIGN KEY (professional_id) REFERENCES professionals(id),
  UNIQUE KEY uq_slot (professional_id, starts_at),
  INDEX idx_slot_status (professional_id, status, starts_at)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- Turnos confirmados (registro de turnos)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  patient_id       INT           NOT NULL,
  professional_id  INT           NOT NULL,
  slot_id          INT           NOT NULL,
  request_id       INT           NULL,
  starts_at        DATETIME      NOT NULL,
  -- confirmed: activo | cancelled: anulado | rescheduled: reprogramado
  status           ENUM('confirmed','cancelled','rescheduled')
                   NOT NULL DEFAULT 'confirmed',
  -- Token para que el paciente gestione (cambiar/anular) su turno
  manage_token     CHAR(36)      NOT NULL,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at     TIMESTAMP     NULL,
  CONSTRAINT fk_appt_patient      FOREIGN KEY (patient_id)      REFERENCES patients(id),
  CONSTRAINT fk_appt_professional FOREIGN KEY (professional_id) REFERENCES professionals(id),
  CONSTRAINT fk_appt_slot         FOREIGN KEY (slot_id)         REFERENCES slots(id),
  CONSTRAINT fk_appt_request      FOREIGN KEY (request_id)      REFERENCES requests(id),
  UNIQUE KEY uq_appt_manage_token (manage_token),
  INDEX idx_appt_starts (starts_at, status),
  INDEX idx_appt_prof (professional_id, starts_at)
) ENGINE=InnoDB;
