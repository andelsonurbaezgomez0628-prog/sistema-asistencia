import prueba from 'node:test';
import afirmar from 'node:assert/strict';
import { readFile as leerArchivo } from 'node:fs/promises';
import { separarSentenciasSql } from '../src/sql.js';

prueba('separa sentencias e ignora comentarios de linea', () => {
  const sql = '-- comentario\nSELECT 1;\n-- otro\nSELECT 2;';
  afirmar.deepEqual(separarSentenciasSql(sql), ['SELECT 1', 'SELECT 2']);
});

prueba('conserva puntos y comas dentro de textos SQL', () => {
  afirmar.deepEqual(separarSentenciasSql("INSERT INTO demo VALUES ('a;b'); SELECT 1;"), [
    "INSERT INTO demo VALUES ('a;b')",
    'SELECT 1',
  ]);
});

prueba('conserva comillas SQL escapadas y textos de varias lineas', () => {
  afirmar.deepEqual(separarSentenciasSql("INSERT INTO demo VALUES ('Ana \\'Maria\\'');\nSELECT 1;"), [
    "INSERT INTO demo VALUES ('Ana \\'Maria\\'')",
    'SELECT 1',
  ]);
});

prueba('separa el numero esperado de sentencias de los SQL del proyecto', async () => {
  const archivos = [
    ['../sql/schema.sql', 20],
    ['../sql/datos_demo.sql', 23],
    ['../sql/migracion_docentes_seccion.sql', 4],
    ['../sql/migracion_rendimiento.sql', 2],
    ['../sql/sesiones.sql', 2],
  ];

  for (const [ruta, esperado] of archivos) {
    const contenido = await leerArchivo(new URL(ruta, import.meta.url), 'utf8');
    afirmar.equal(separarSentenciasSql(contenido).length, esperado, ruta);
  }
});
