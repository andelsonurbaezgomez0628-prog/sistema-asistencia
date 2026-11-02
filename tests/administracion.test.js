import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('las secciones validan y guardan varios docentes activos', async () => {
  const fuente = await readFile(new URL('../src/routes/administracion.js', import.meta.url), 'utf8');
  assert.match(fuente, /function normalizarIdsDocentes\(valor\)/);
  assert.match(fuente, /function docentesValidos\(ids, seccionId = null\)/);
  assert.match(fuente, /INSERT INTO seccion_docentes \(seccion_id, docente_id\)/);
  assert.match(fuente, /unnest\(\$2::integer\[\]\)/);
  assert.doesNotMatch(fuente, /SET nombre = \$1, curso_id = \$2, docente_id = \$3/);
});

test('la migracion copia la asignacion anterior antes de quitar docente_id', async () => {
  const sql = await readFile(new URL('../sql/migracion_docentes_seccion.sql', import.meta.url), 'utf8');
  assert.match(sql, /INSERT INTO seccion_docentes \(seccion_id, docente_id\)/);
  assert.match(sql, /SELECT id, docente_id FROM secciones/);
  assert.match(sql, /ALTER TABLE secciones DROP COLUMN IF EXISTS docente_id/);
});

test('asistencia, alertas y reportes autorizan por asignacion de seccion', async () => {
  const seguimiento = await readFile(new URL('../src/routes/seguimiento.js', import.meta.url), 'utf8');
  const servidor = await readFile(new URL('../src/server.js', import.meta.url), 'utf8');
  assert.ok((seguimiento.match(/seccion_docentes/g) || []).length >= 6);
  assert.match(seguimiento, /docente_asignado/);
  assert.match(servidor, /seccion_docentes/);
  assert.doesNotMatch(seguimiento, /s\.docente_id/);
  assert.doesNotMatch(servidor, /s\.docente_id/);
  assert.match(seguimiento, /SELECT s\.id, s\.nombre, s\.curso_id, c\.nombre AS curso/);
});

test('el detalle de reportes limita al estudiante por permisos y consulta su historial', async () => {
  const seguimiento = await readFile(new URL('../src/routes/seguimiento.js', import.meta.url), 'utf8');
  const inicio = seguimiento.indexOf("router.get('/reportes/estudiantes/:id'");
  const fin = seguimiento.indexOf("router.get('/reportes'", inicio);
  const ruta = seguimiento.slice(inicio, fin);
  assert.match(ruta, /router\.get\('\/reportes\/estudiantes\/:id', requerirLogin/);
  assert.match(ruta, /validarId\(req\.params\.id\)/);
  assert.match(ruta, /sd\.docente_id = \$2/);
  assert.match(ruta, /const valoresEstudiante = \[idEstudiante\]/);
  assert.match(ruta, /WHERE estudiante_id = \$1 AND fecha BETWEEN \$2 AND \$3/);
  assert.match(ruta, /no tienes acceso/);
});

test('el perfil solo modifica datos de la cuenta autenticada y protege el cambio con CSRF', async () => {
  const fuente = await readFile(new URL('../src/routes/seguimiento.js', import.meta.url), 'utf8');
  const inicio = fuente.indexOf("router.post('/cuenta/perfil'");
  const fin = fuente.indexOf("router.post('/cuenta/clave'", inicio);
  const ruta = fuente.slice(inicio, fin);
  assert.match(ruta, /router\.post\('\/cuenta\/perfil', requerirLogin, protegerCsrf/);
  assert.match(ruta, /bcrypt\.compare\(claveActual, filas\[0\]\.password_hash\)/);
  assert.match(ruta, /WHERE id = \$4 AND activo IS TRUE/);
  assert.match(ruta, /\[nombre, cedula, usuario, req\.user\.id\]/);
  assert.doesNotMatch(ruta, /req\.body\.(?:id|rol|activo)/);
  assert.doesNotMatch(ruta, /UPDATE usuarios SET[^`]*\b(?:rol|activo)\s*=/);
});
