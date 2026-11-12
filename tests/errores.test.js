import test from 'node:test';
import assert from 'node:assert/strict';
import { esErrorTransitorio, esperarReintento } from '../src/errores.js';

test('reconoce cortes transitorios de red y de PostgreSQL', () => {
  for (const codigo of ['ECONNRESET', 'ETIMEDOUT', '08006', '57P01']) {
    assert.equal(esErrorTransitorio({ code: codigo }), true, codigo);
  }
});

test('reconoce tiempos de espera que solo traen mensaje', () => {
  assert.equal(esErrorTransitorio({ message: 'Query read timeout' }), true);
  assert.equal(esErrorTransitorio({ message: 'syntax error at or near "SELEC"' }), false);
});

test('no marca como transitorios los errores definitivos', () => {
  for (const error of [null, undefined, {}, { code: '23505' }, { code: '42P01' }]) {
    assert.equal(esErrorTransitorio(error), false);
  }
});

test('esperarReintento deja pasar el tiempo indicado', async () => {
  const inicio = Date.now();
  await esperarReintento(30);
  assert.ok(Date.now() - inicio >= 25);
});
