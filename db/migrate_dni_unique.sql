-- ==========================================================================
-- Migracion: usar el DNI (en vez del telefono) como identidad unica del
-- paciente. Ver PatientModel.upsert para la logica que la acompaña.
--
-- Pensada para correrse UNA sola vez (no usa IF EXISTS: esa sintaxis no es
-- compatible con la version de MySQL de Aiven). Si se corre dos veces, la
-- segunda vez va a fallar con un error claro (el indice ya no existe/ya
-- existe) en vez de fallar en silencio.
--
-- Uso (contra la base real en Aiven):
--   mysql -h TU_HOST.aivencloud.com -P TU_PUERTO -u avnadmin -p \
--         --ssl-mode=REQUIRED tu_bienestar < db/migrate_dni_unique.sql
-- ==========================================================================

ALTER TABLE patients DROP INDEX uq_patient_phone;
ALTER TABLE patients ADD UNIQUE INDEX uq_patient_dni (dni);
