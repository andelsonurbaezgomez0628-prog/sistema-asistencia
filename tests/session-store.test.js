import prueba from 'node:test';
import afirmar from 'node:assert/strict';
import { PostgresSessionStore } from '../src/session-store.js';

function esperarFinalizacion(ejecutar) {
  return new Promise((resolver, rechazar) => {
    ejecutar((error, resultado) => error ? rechazar(error) : resolver(resultado));
  });
}

prueba('lee y decodifica una sesion vigente', async () => {
  const baseDatosFalsa = {
    async query(sql, valores) {
      afirmar.match(sql, /expires > \$2/);
      afirmar.equal(valores[0], 'sesion-1');
      return { rows: [{ data: '{"userId":7}' }] };
    },
  };
  const almacenSesion = new PostgresSessionStore(baseDatosFalsa, 60000);
  try {
    const sesion = await esperarFinalizacion((funcionFinalizacion) => almacenSesion.get('sesion-1', funcionFinalizacion));
    afirmar.deepEqual(sesion, { userId: 7 });
  } finally {
    almacenSesion.close();
  }
});

prueba('guarda una sesion serializada con expiracion', async () => {
  const datosSesion = { cookie: { expires: new Date('2026-10-26T12:00:00.000Z') }, userId: 3 };
  const baseDatosFalsa = {
    async query(sql, valores) {
      afirmar.match(sql, /VALUES \(\$1, \$2, \$3\)/);
      afirmar.match(sql, /ON CONFLICT \(session_id\)/);
      afirmar.equal(valores[0], 'sesion-2');
      afirmar.equal(valores[1], Date.parse(datosSesion.cookie.expires) / 1000);
      afirmar.deepEqual(JSON.parse(valores[2]), JSON.parse(JSON.stringify(datosSesion)));
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

prueba('una sesion con JSON danado se trata como inexistente', async () => {
  const baseDatosFalsa = {
    async query() {
      return { rows: [{ data: '{no-es-json' }] };
    },
  };
  const almacenSesion = new PostgresSessionStore(baseDatosFalsa, 60000);
  try {
    const sesion = await esperarFinalizacion((funcionFinalizacion) => almacenSesion.get('sesion-danada', funcionFinalizacion));
    afirmar.equal(sesion, null);
  } finally {
    almacenSesion.close();
  }
});

prueba('elimina una sesion al cerrar sesion', async () => {
  const baseDatosFalsa = {
    async query(sql, valores) {
      afirmar.match(sql, /DELETE FROM sesiones WHERE session_id = \$1/);
      afirmar.deepEqual(valores, ['sesion-3']);
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
