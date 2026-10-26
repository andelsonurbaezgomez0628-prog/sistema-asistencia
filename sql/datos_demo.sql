-- ================================================================
-- ASISTENCIA ESCOLAR INTELIGENTE
-- sql/datos_demo.sql  ->  Datos de ejemplo para la demostracion
--
-- Como usar: se instala solo, junto con el schema, ejecutando
--     npm run db:setup
--
-- IMPORTANTE: las fechas se calculan desde CURRENT_DATE de PostgreSQL,
-- o sea "relativo a hoy": el demo SIEMPRE muestra alertas vivas, incluso
-- si se presenta dentro de seis meses.
--
-- Escenarios sembrados a proposito (el panel de Alertas debe mostrar
-- exactamente 2 alertas ALTAS y 2 MEDIAS):
--   Pablo    (id 1): 3 ausencias en 3 dias consecutivos      -> ALTA (racha)
--   Luis     (id 2): 3 ausencias salteadas                   -> MEDIA
--   Maria    (id 3): 3 ausencias consecutivas + 4 tardanzas  -> ALTA (racha + score)
--   Andrea   (id 4): 3 ausencias salteadas                   -> MEDIA
--   Carlos   (id 5): 1 falta + 1 justificado                 -> sin alerta (riesgo bajo)
--   Jose     (id 6): 2 tardanzas                             -> sin alerta (riesgo bajo)
-- ================================================================

-- ----------------------------------------------------------------
-- USUARIOS (contrasenas hasheadas con bcrypt; password_verify las acepta)
--   admin      / 12345678 (solo demo; cambiar antes de usar datos reales)
--   profesor1  / profe123
--   profesor2  / profe123
-- ----------------------------------------------------------------
INSERT INTO usuarios (id, nombre, cedula, usuario, rol, activo, password_hash) VALUES
(1, 'Ana Pérez',        '40101010', 'admin',     'admin',   TRUE, '$2b$12$msEz.uVLlHQeQZ5rVD11p.XG/oJi5fKh9h0eB5m7tjCL6JqwWWMnm'),
(2, 'Luis González',    '12345678', 'profesor1', 'docente', TRUE, '$2b$10$b/NL8iJaOSDM.NZxaulxpOzu3ecZJDaSObuxn8eSDsQJUSFSCDh7m'),
(3, 'Carmen Rodríguez', '87654321', 'profesor2', 'docente', TRUE, '$2b$10$b/NL8iJaOSDM.NZxaulxpOzu3ecZJDaSObuxn8eSDsQJUSFSCDh7m');

-- ----------------------------------------------------------------
-- CURSOS
-- ----------------------------------------------------------------
INSERT INTO cursos (id, nombre, descripcion) VALUES
(1, '5to Año Informática', 'Bachillerato en Informática'),
(2, '5to Año Contaduría',  'Bachillerato en Contaduría'),
(3, '4to Año General',     'Cuarto año del tronco común');

-- ----------------------------------------------------------------
-- SECCIONES (un curso puede tener varias secciones)
-- ----------------------------------------------------------------
INSERT INTO secciones (id, nombre, curso_id, anio_escolar) VALUES
(1, 'Sección A', 1, '2025-2026'),
(2, 'Sección B', 1, '2025-2026'),
(3, 'Sección A', 2, '2025-2026'),
(4, 'Sección A', 3, '2025-2026');

INSERT INTO seccion_docentes (seccion_id, docente_id) VALUES
(1, 2), (2, 2), (3, 3), (4, 3);

-- ----------------------------------------------------------------
-- ESTUDIANTES (20: los seis primeros estan en la Seccion A (1), que es
-- la del docente de la demostracion; ids 7-12 tambien). El numero de
-- lista es unico dentro de cada seccion y no supera 40.
-- ----------------------------------------------------------------
INSERT INTO estudiantes (id, numero_lista, nombre, apellido, fecha_nacimiento, seccion_id, activo) VALUES
(1,  27, 'Pablo',    'Martínez',   '2007-03-12', 1, TRUE),
(2,  4,  'Luis',     'Hernández',  '2007-07-25', 1, TRUE),
(3,  33, 'María',    'García',     '2007-01-08', 1, TRUE),
(4,  12, 'Andrea',   'López',      '2006-11-30', 1, TRUE),
(5,  19, 'Carlos',   'Sánchez',    '2007-05-17', 1, TRUE),
(6,  8,  'José',     'Ramírez',    '2007-02-03', 1, TRUE),
(7,  36, 'Luisana',  'Torres',     '2007-09-21', 1, TRUE),
(8,  22, 'Gabriel',  'Flores',     '2006-12-14', 1, TRUE),
(9,  15, 'Valeria',  'Jiménez',    '2007-04-09', 1, TRUE),
(10, 30, 'Diego',    'Mendoza',    '2007-08-27', 1, TRUE),
(11, 6,  'Isabella', 'Castillo',   '2007-06-19', 1, TRUE),
(12, 25, 'Samuel',   'Vargas',     '2006-10-05', 1, TRUE),
(13, 18, 'Yuliana',  'Rojas',      '2007-03-28', 2, TRUE),
(14, 7,  'Andrés',   'Blanco',     '2007-05-02', 2, TRUE),
(15, 31, 'Katherin', 'Mora',       '2006-12-23', 2, TRUE),
(16, 24, 'Emilio',   'Herrera',    '2007-07-11', 2, TRUE),
(17, 11, 'Paola',    'Aguilar',    '2007-01-15', 3, TRUE),
(18, 38, 'Ricardo',  'Medina',     '2007-09-06', 3, TRUE),
(19, 29, 'Natalia',  'Delgado',    '2008-02-18', 4, TRUE),
(20, 3,  'Fermín',   'Colmenárez', '2008-04-30', 4, TRUE);

INSERT INTO asistencia (estudiante_id, fecha, estado, creado_por)
SELECT e.id, CURRENT_DATE, 'presente', 2 FROM estudiantes e WHERE e.id BETWEEN 7 AND 12;

INSERT INTO asistencia (estudiante_id, fecha, estado, creado_por)
SELECT e.id, CURRENT_DATE - 1, 'presente', 2 FROM estudiantes e WHERE e.id BETWEEN 7 AND 12;

INSERT INTO asistencia (estudiante_id, fecha, estado, creado_por)
SELECT e.id, CURRENT_DATE - 2, 'presente', 2 FROM estudiantes e WHERE e.id BETWEEN 7 AND 12;

INSERT INTO asistencia (estudiante_id, fecha, estado, creado_por)
SELECT e.id, CURRENT_DATE - 3, 'presente', 2 FROM estudiantes e WHERE e.id BETWEEN 7 AND 12;

INSERT INTO asistencia (estudiante_id, fecha, estado, creado_por)
SELECT e.id, CURRENT_DATE - 4, 'presente', 2 FROM estudiantes e WHERE e.id BETWEEN 7 AND 12;

INSERT INTO asistencia (estudiante_id, fecha, estado, observacion, creado_por) VALUES
(1, CURRENT_DATE - 2, 'ausente', 'Sin aviso previo', 2),
(1, CURRENT_DATE - 1, 'ausente', 'Sin aviso previo', 2),
(1, CURRENT_DATE,     'ausente', 'Sin aviso previo', 2);

INSERT INTO asistencia (estudiante_id, fecha, estado, observacion, creado_por) VALUES
(2, CURRENT_DATE - 5,  'ausente', 'No asistió', 2),
(2, CURRENT_DATE - 9,  'ausente', 'No asistió', 2),
(2, CURRENT_DATE - 13, 'ausente', 'No asistió', 2);

INSERT INTO asistencia (estudiante_id, fecha, estado, observacion, creado_por) VALUES
(3, CURRENT_DATE - 6,  'ausente',  'Falta sin justificar', 2),
(3, CURRENT_DATE - 5,  'ausente',  'Falta sin justificar', 2),
(3, CURRENT_DATE - 4,  'ausente',  'Falta sin justificar', 2),
(3, CURRENT_DATE - 10, 'tardanza', 'Llegó 25 min tarde', 2),
(3, CURRENT_DATE - 12, 'tardanza', 'Llegó 15 min tarde', 2),
(3, CURRENT_DATE - 15, 'tardanza', 'Llegó 20 min tarde', 2),
(3, CURRENT_DATE - 18, 'tardanza', 'Llegó 30 min tarde', 2);

INSERT INTO asistencia (estudiante_id, fecha, estado, observacion, creado_por) VALUES
(4, CURRENT_DATE - 7,  'ausente', 'Falta sin justificar', 2),
(4, CURRENT_DATE - 11, 'ausente', 'Falta sin justificar', 2),
(4, CURRENT_DATE - 16, 'ausente', 'Falta sin justificar', 2);

INSERT INTO asistencia (estudiante_id, fecha, estado, observacion, creado_por) VALUES
(5, CURRENT_DATE - 8,  'ausente',     'Un día sin aviso', 2),
(5, CURRENT_DATE - 20, 'justificado', 'Constancia médica', 2);

INSERT INTO asistencia (estudiante_id, fecha, estado, observacion, creado_por) VALUES
(6, CURRENT_DATE - 2, 'tardanza', 'Llegó tarde por el transporte', 2),
(6, CURRENT_DATE - 4, 'tardanza', 'Llegó tarde por el transporte', 2);

-- ----------------------------------------------------------------
INSERT INTO alertas (estudiante_id, nivel, faltas_30_dias, racha_maxima, mensaje, fecha_deteccion, estado) VALUES
(1, 'alto',  3, 3, 'Riesgo ALTO: 3 ausencias sin justificar en 30 días, racha máxima de 3 días consecutivos. Se recomienda contactar al representante.', CURRENT_DATE, 'pendiente'),
(2, 'medio', 3, 1, 'Riesgo MEDIO: 3 ausencias sin justificar en 30 días. Se recomienda contactar al representante.', CURRENT_DATE, 'pendiente'),
(3, 'alto',  3, 3, 'Riesgo ALTO: 3 ausencias sin justificar en 30 días, racha máxima de 3 días consecutivos, además de 4 tardanzas. Se recomienda contactar al representante.', CURRENT_DATE, 'pendiente'),
(4, 'medio', 3, 1, 'Riesgo MEDIO: 3 ausencias sin justificar en 30 días. Se recomienda contactar al representante.', CURRENT_DATE, 'pendiente');

-- Las identidades se reajustan al final porque el demo asigna IDs fijos.
SELECT setval(pg_get_serial_sequence('usuarios', 'id'), COALESCE((SELECT MAX(id) FROM usuarios), 1), EXISTS (SELECT 1 FROM usuarios));
SELECT setval(pg_get_serial_sequence('cursos', 'id'), COALESCE((SELECT MAX(id) FROM cursos), 1), EXISTS (SELECT 1 FROM cursos));
SELECT setval(pg_get_serial_sequence('secciones', 'id'), COALESCE((SELECT MAX(id) FROM secciones), 1), EXISTS (SELECT 1 FROM secciones));
SELECT setval(pg_get_serial_sequence('estudiantes', 'id'), COALESCE((SELECT MAX(id) FROM estudiantes), 1), EXISTS (SELECT 1 FROM estudiantes));
SELECT setval(pg_get_serial_sequence('asistencia', 'id'), COALESCE((SELECT MAX(id) FROM asistencia), 1), EXISTS (SELECT 1 FROM asistencia));
SELECT setval(pg_get_serial_sequence('alertas', 'id'), COALESCE((SELECT MAX(id) FROM alertas), 1), EXISTS (SELECT 1 FROM alertas));
