import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('la creacion de secciones revisa curso y docente por separado', async () => {
  // Promise.all devuelve dos arreglos; destructurar solo el primero hacia
  // que relaciones[1] fuera una fila de curso y provocara un error 500.
  const fuente = await readFile(new URL('../src/routes/administracion.js', import.meta.url), 'utf8');
  assert.doesNotMatch(fuente, /const \[relaciones\] = await Promise\.all/);
  assert.match(fuente, /const \[cursosEncontrados, docentesEncontrados\] = await Promise\.all/);
  assert.match(fuente, /cursosEncontrados\.length === 0 \|\| docentesEncontrados\.length === 0/);
});
