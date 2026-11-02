-- Agrega almacenamiento opcional de fotos sin alterar registros existentes.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_data BYTEA;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_tipo VARCHAR(30);
ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS foto_data BYTEA;
ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS foto_tipo VARCHAR(30);
