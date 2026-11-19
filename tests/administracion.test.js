import prueba from 'node:test';
import afirmar from 'node:assert/strict';
import { readFile as leerArchivo } from 'node:fs/promises';

prueba('las secciones validan y guardan varios docentes activos', async () => {
  const fuente = await leerArchivo(new URL('../src/routes/administracion.js', import.meta.url), 'utf8');
  afirmar.match(fuente, /function normalizarIdsDocentes\(valor\)/);
  afirmar.match(fuente, /function docentesValidos\(ids, seccionId = null\)/);
  afirmar.match(fuente, /INSERT INTO seccion_docentes \(seccion_id, docente_id\)/);
  afirmar.match(fuente, /unnest\(\$2::integer\[\]\)/);
  afirmar.doesNotMatch(fuente, /SET nombre = \$1, curso_id = \$2, docente_id = \$3/);
});

prueba('la migracion copia la asignacion anterior antes de quitar docente_id', async () => {
  const sql = await leerArchivo(new URL('../sql/migracion_docentes_seccion.sql', import.meta.url), 'utf8');
  afirmar.match(sql, /INSERT INTO seccion_docentes \(seccion_id, docente_id\)/);
  afirmar.match(sql, /SELECT id, docente_id FROM secciones/);
  afirmar.match(sql, /ALTER TABLE secciones DROP COLUMN IF EXISTS docente_id/);
});

prueba('asistencia, alertas y reportes autorizan por asignacion de seccion', async () => {
  const seguimiento = await leerArchivo(new URL('../src/routes/seguimiento.js', import.meta.url), 'utf8');
  const servidor = await leerArchivo(new URL('../src/server.js', import.meta.url), 'utf8');
  afirmar.ok((seguimiento.match(/seccion_docentes/g) || []).length >= 6);
  afirmar.match(seguimiento, /docente_asignado/);
  afirmar.match(servidor, /seccion_docentes/);
  afirmar.doesNotMatch(seguimiento, /s\.docente_id/);
  afirmar.doesNotMatch(servidor, /s\.docente_id/);
  afirmar.match(seguimiento, /SELECT s\.id, s\.nombre, s\.curso_id, c\.nombre AS curso/);
});

prueba('el detalle de reportes limita al estudiante por permisos y consulta su historial', async () => {
  const seguimiento = await leerArchivo(new URL('../src/routes/seguimiento.js', import.meta.url), 'utf8');
  const inicio = seguimiento.indexOf("enrutador.get('/reportes/estudiantes/:id'");
  const fin = seguimiento.indexOf("enrutador.get('/reportes'", inicio);
  const ruta = seguimiento.slice(inicio, fin);
  afirmar.match(ruta, /router\.get\('\/reportes\/estudiantes\/:id', requerirLogin/);
  afirmar.match(ruta, /validarId\(solicitud\.params\.id\)/);
  afirmar.match(ruta, /sd\.docente_id = \$2/);
  afirmar.match(ruta, /const valoresEstudiante = \[idEstudiante\]/);
  afirmar.match(ruta, /WHERE estudiante_id = \$1 AND fecha BETWEEN \$2 AND \$3/);
  afirmar.match(ruta, /no tienes acceso/);
});

prueba('el perfil solo modifica datos de la cuenta autenticada y protege el cambio con CSRF', async () => {
  const fuente = await leerArchivo(new URL('../src/routes/seguimiento.js', import.meta.url), 'utf8');
  const inicio = fuente.indexOf("enrutador.post('/cuenta/perfil'");
  const fin = fuente.indexOf("enrutador.post('/cuenta/clave'", inicio);
  const ruta = fuente.slice(inicio, fin);
  afirmar.match(ruta, /router\.post\('\/cuenta\/perfil', requerirLogin, protegerCsrf/);
  afirmar.match(ruta, /bcrypt\.compare\(claveActual, filas\[0\]\.password_hash\)/);
  afirmar.match(ruta, /WHERE id = \$4 AND activo IS TRUE/);
  afirmar.match(ruta, /\[nombre, cedula, usuario, solicitud\.user\.id\]/);
  afirmar.doesNotMatch(ruta, /solicitud\.body\.(?:id|rol|activo)/);
  afirmar.doesNotMatch(ruta, /UPDATE usuarios SET[^`]*\b(?:rol|activo)\s*=/);
});
