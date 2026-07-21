-- ==========================================================================
-- Datos de ejemplo para probar la aplicacion
-- ==========================================================================
USE consultorio;

INSERT INTO professionals (full_name, specialty, email, phone, active) VALUES
  ('Dra. Ana Gomez',    'Clinica Medica', 'ana.gomez@consultorio.com',    '+5493487645439', 1),
  ('Dr. Luis Martinez', 'Cardiologia',    'luis.martinez@consultorio.com','+5491122222222', 1),
  ('Dra. Sofia Ruiz',   'Dermatologia',   'sofia.ruiz@consultorio.com',   '+5491133333333', 1);

-- Genera algunos horarios disponibles para manana y pasado, de 09 a 12 hs.
INSERT INTO slots (professional_id, starts_at, duration_min, status)
SELECT p.id,
       DATE_ADD(DATE_ADD(CURDATE(), INTERVAL d.n DAY),
                INTERVAL (9*60 + h.n*30) MINUTE) AS starts_at,
       30, 'available'
FROM professionals p
CROSS JOIN (SELECT 1 AS n UNION SELECT 2) d
CROSS JOIN (SELECT 0 AS n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3
            UNION SELECT 4 UNION SELECT 5) h
WHERE p.active = 1;
