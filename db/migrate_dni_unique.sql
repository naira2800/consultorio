-- ==========================================================================
-- Migracion: usar el DNI (en vez del telefono) como identidad unica del
-- paciente. Ver PatientModel.upsert para la logica que la acompaña.
--
-- Es seguro correrla mas de una vez (usa IF EXISTS / IF NOT EXISTS).
--
-- Uso (contra la base real en Aiven):
--   mysql -h TU_HOST.aivencloud.com -P TU_PUERTO -u avnadmin -p \
--         --ssl-mode=REQUIRED tu_bienestar < db/migrate_dni_unique.sql
-- ==========================================================================

ALTER TABLE patients DROP INDEX IF EXISTS uq_patient_phone;
ALTER TABLE patients ADD UNIQUE INDEX IF NOT EXISTS uq_patient_dni (dni);
