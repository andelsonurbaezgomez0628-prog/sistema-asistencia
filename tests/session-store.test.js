import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresSessionStore } from '../src/session-store.js';

function esperarCallback(ejecutar) {
  return new Promise((resolve, reject) => {
    ejecutar((error, resultado) => error ? reject(error) : resolve(resultado));
  });
}

test('lee y decodifica una sesion vigente', async () => {
  const db = {
    async query(sql, valores) {
      assert.match(sql, /expires > \$2/);
      assert.equal(valores[0], 'sesion-1');
      return { rows: [{ data: '{"userId":7}' }] };
    },
  };
  const store = new PostgresSessionStore(db, 60000);
  try {
    const sesion = await esperarCallback((callback) => store.get('sesion-1', callback));
    assert.deepEqual(sesion, { userId: 7 });
  } finally {
    store.close();
  }
});

test('guarda una sesion serializada con expiracion', async () => {
  const sessionData = { cookie: { expires: new Date('2026-10-26T12:00:00.000Z') }, userId: 3 };
  const db = {
    async query(sql, valores) {
      assert.match(sql, /VALUES \(\$1, \$2, \$3\)/);
      assert.match(sql, /ON CONFLICT \(session_id\)/);
      assert.equal(valores[0], 'sesion-2');
      assert.equal(valores[1], Date.parse(sessionData.cookie.expires) / 1000);
      assert.deepEqual(JSON.parse(valores[2]), JSON.parse(JSON.stringify(sessionData)));
      return { rowCount: 1 };
    },
  };
  const store = new PostgresSessionStore(db, 60000);
  try {
    await esperarCallback((callback) => store.set('sesion-2', sessionData, callback));
  } finally {
    store.close();
  }
});

test('elimina una sesion al cerrar sesion', async () => {
  const db = {
    async query(sql, valores) {
      assert.match(sql, /DELETE FROM sesiones WHERE session_id = \$1/);
      assert.deepEqual(valores, ['sesion-3']);
      return { rowCount: 1 };
    },
  };
  const store = new PostgresSessionStore(db, 60000);
  try {
    await esperarCallback((callback) => store.destroy('sesion-3', callback));
  } finally {
    store.close();
  }
});