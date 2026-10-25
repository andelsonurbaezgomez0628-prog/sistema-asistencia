-- Migracion para instalaciones creadas antes de usar numero de lista.
-- Reemplaza estudiantes.cedula por estudiantes.numero_lista sin tocar
-- asistencias ni alertas, porque ambas referencian estudiantes.id.
--
-- El instalador solo ejecuta este archivo cuando detecta la columna
-- cedula y aun no existe numero_lista.

ALTER TABLE estudiantes ADD COLUMN numero_lista SMALLINT;

WITH secciones AS (
  SELECT DISTINCT seccion_id FROM estudiantes
),
numeros AS (
  SELECT s.seccion_id, n.numero,
    ROW_NUMBER() OVER (PARTITION BY s.seccion_id ORDER BY random()) AS posicion
  FROM secciones s
  CROSS JOIN generate_series(1, 40) AS n(numero)
),
estudiantes_ordenados AS (
  SELECT id, seccion_id,
    ROW_NUMBER() OVER (PARTITION BY seccion_id ORDER BY random()) AS posicion
  FROM estudiantes
)
UPDATE estudiantes e
SET numero_lista = n.numero
FROM estudiantes_ordenados eo
INNER JOIN numeros n
  ON n.seccion_id = eo.seccion_id AND n.posicion = eo.posicion
WHERE e.id = eo.id;

ALTER TABLE estudiantes ALTER COLUMN numero_lista SET NOT NULL;
ALTER TABLE estudiantes ADD CONSTRAINT estudiantes_numero_lista_check CHECK (numero_lista BETWEEN 1 AND 40);
ALTER TABLE estudiantes ADD CONSTRAINT uq_estudiante_seccion_lista UNIQUE (seccion_id, numero_lista);
ALTER TABLE estudiantes DROP COLUMN cedula;
