-- Aplicar una sola vez después de 005, con el backend detenido.
-- Conserva usuarios, claves foráneas y datos históricos. active sigue indicando habilitación.
BEGIN;
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;
COMMIT;
