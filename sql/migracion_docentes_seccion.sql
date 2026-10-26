-- Conserva la asignacion actual antes de permitir varios docentes por seccion.
CREATE TABLE IF NOT EXISTS seccion_docentes (
  seccion_id INTEGER NOT NULL REFERENCES secciones(id) ON DELETE CASCADE,
  docente_id INTEGER NOT NULL REFERENCES usuarios(id),
  PRIMARY KEY (seccion_id, docente_id)
);

CREATE INDEX IF NOT EXISTS idx_seccion_docentes_docente ON seccion_docentes (docente_id);

INSERT INTO seccion_docentes (seccion_id, docente_id)
SELECT id, docente_id FROM secciones WHERE docente_id IS NOT NULL
ON CONFLICT (seccion_id, docente_id) DO NOTHING;

ALTER TABLE secciones DROP COLUMN IF EXISTS docente_id;
