import prueba from 'node:test';
import afirmar from 'node:assert/strict';
import { esErrorTransitorio, esperarReintento } from '../src/errores.js';

prueba('reconoce cortes transitorios de red y de PostgreSQL', () => {
  for (const codigo of ['ECONNRESET', 'ETIMEDOUT', '08006', '57P01']) {
    afirmar.equal(esErrorTransitorio({ code: codigo }), true, codigo);
  }
});

prueba('reconoce tiempos de espera que solo traen mensaje', () => {
  afirmar.equal(esErrorTransitorio({ message: 'Query read timeout' }), true);
  afirmar.equal(esErrorTransitorio({ message: 'syntax error at or near "SELEC"' }), false);
});

prueba('no marca como transitorios los errores definitivos', () => {
  for (const error of [null, undefined, {}, { code: '23505' }, { code: '42P01' }]) {
    afirmar.equal(esErrorTransitorio(error), false);
  }
});

prueba('esperarReintento deja pasar el tiempo indicado', async () => {
  const inicio = Date.now();
  await esperarReintento(30);
  afirmar.ok(Date.now() - inicio >= 25);
});
