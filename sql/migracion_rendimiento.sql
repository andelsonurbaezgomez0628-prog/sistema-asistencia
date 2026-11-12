-- Indices para acelerar reportes y alertas en bases ya instaladas.
-- IF NOT EXISTS permite ejecutar el archivo varias veces sin duplicar indices.

CREATE INDEX IF NOT EXISTS idx_asistencia_fecha_estado ON asistencia (fecha, estado);

CREATE INDEX IF NOT EXISTS idx_alertas_estudiante_fecha ON alertas (estudiante_id, fecha_deteccion DESC, estado);
