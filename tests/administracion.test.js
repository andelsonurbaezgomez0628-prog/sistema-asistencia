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
});
