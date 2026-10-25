import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { separarSentenciasSql } from '../src/sql.js';

test('separa sentencias e ignora comentarios de linea', () => {
  const sql = '-- comentario\nSELECT 1;\n-- otro\nSELECT 2;';
  assert.deepEqual(separarSentenciasSql(sql), ['SELECT 1', 'SELECT 2']);
});

test('conserva puntos y comas dentro de textos SQL', () => {
  assert.deepEqual(separarSentenciasSql("INSERT INTO demo VALUES ('a;b'); SELECT 1;"), [
    "INSERT INTO demo VALUES ('a;b')",
    'SELECT 1',
  ]);
});

test('conserva comillas SQL escapadas y textos de varias lineas', () => {
  assert.deepEqual(separarSentenciasSql("INSERT INTO demo VALUES ('Ana \\'Maria\\'');\nSELECT 1;"), [
    "INSERT INTO demo VALUES ('Ana \\'Maria\\'')",
    'SELECT 1',
  ]);
});

test('separa el numero esperado de sentencias de los SQL del proyecto', async () => {
  const archivos = [
    ['../sql/schema.sql', 15],
    ['../sql/datos_demo.sql', 22],
    ['../sql/sesiones.sql', 2],
  ];

  for (const [ruta, esperado] of archivos) {
    const contenido = await readFile(new URL(ruta, import.meta.url), 'utf8');
    assert.equal(separarSentenciasSql(contenido).length, esperado, ruta);
  }
});