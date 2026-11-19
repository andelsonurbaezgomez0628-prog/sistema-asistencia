import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresSessionStore } from '../src/session-store.js';

function esperarFinalizacion(ejecutar) {
  return new Promise((resolver, rechazar) => {
    ejecutar((error, resultado) => error ? rechazar(error) : resolver(resultado));
  });
}

test('lee y decodifica una sesion vigente', async () => {
  const baseDatosFalsa = {
    async query(sql, valores) {
      assert.match(sql, /expires > \$2/);
      assert.equal(valores[0], 'sesion-1');
      return { rows: [{ data: '{"userId":7}' }] };
    },
  };
  const almacenSesion = new PostgresSessionStore(baseDatosFalsa, 60000);
  try {
    const sesion = await esperarFinalizacion((funcionFinalizacion) => almacenSesion.get('sesion-1', funcionFinalizacion));
    assert.deepEqual(sesion, { userId: 7 });
  } finally {
    almacenSesion.close();
  }
});

test('guarda una sesion serializada con expiracion', async () => {
  const datosSesion = { cookie: { expires: new Date('2026-10-26T12:00:00.000Z') }, userId: 3 };
  const baseDatosFalsa = {
    async query(sql, valores) {
      assert.match(sql, /VALUES \(\$1, \$2, \$3\)/);
      assert.match(sql, /ON CONFLICT \(session_id\)/);
      assert.equal(valores[0], 'sesion-2');
      assert.equal(valores[1], Date.parse(datosSesion.cookie.expires) / 1000);
      assert.deepEqual(JSON.parse(valores[2]), JSON.parse(JSON.stringify(datosSesion)));
      return { rowCount: 1 };
    },
  };
  const almacenSesion = new PostgresSessionStore(baseDatosFalsa, 60000);
  try {
    await esperarFinalizacion((funcionFinalizacion) => almacenSesion.set('sesion-2', datosSesion, funcionFinalizacion));
  } finally {
    almacenSesion.close();
  }
});

test('una sesion con JSON danado se trata como inexistente', async () => {
  const baseDatosFalsa = {
    async query() {
      return { rows: [{ data: '{no-es-json' }] };
    },
  };
  const almacenSesion = new PostgresSessionStore(baseDatosFalsa, 60000);
  try {
    const sesion = await esperarFinalizacion((funcionFinalizacion) => almacenSesion.get('sesion-danada', funcionFinalizacion));
    assert.equal(sesion, null);
  } finally {
    almacenSesion.close();
  }
});

test('elimina una sesion al cerrar sesion', async () => {
  const baseDatosFalsa = {
    async query(sql, valores) {
      assert.match(sql, /DELETE FROM sesiones WHERE session_id = \$1/);
      assert.deepEqual(valores, ['sesion-3']);
      return { rowCount: 1 };
    },
  };
  const almacenSesion = new PostgresSessionStore(baseDatosFalsa, 60000);
  try {
    await esperarFinalizacion((funcionFinalizacion) => almacenSesion.destroy('sesion-3', funcionFinalizacion));
  } finally {
    almacenSesion.close();
  }
});
