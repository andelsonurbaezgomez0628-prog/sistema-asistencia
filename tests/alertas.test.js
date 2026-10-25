import test from 'node:test';
import assert from 'node:assert/strict';
import { calcula_racha_maxima, clasificar_riesgo } from '../src/alertas.js';

test('sin faltas ni tardanzas queda en nivel bajo', () => {
  assert.equal(clasificar_riesgo(0, 0, 0).nivel, 'bajo');
});

test('tres faltas generan nivel medio', () => {
  assert.equal(clasificar_riesgo(3, 0, 0).nivel, 'medio');
});

test('cinco faltas generan nivel alto', () => {
  assert.equal(clasificar_riesgo(5, 0, 0).nivel, 'alto');
});

test('racha de tres dias genera nivel alto', () => {
  assert.equal(clasificar_riesgo(2, 0, 3).nivel, 'alto');
});

test('cuatro tardanzas agregan un punto al score', () => {
  assert.equal(clasificar_riesgo(2, 4, 0).nivel, 'medio');
});

test('tres tardanzas no agregan un punto', () => {
  assert.equal(clasificar_riesgo(2, 3, 0).nivel, 'bajo');
});

test('sin fechas de ausencia la racha es cero', () => {
  assert.equal(calcula_racha_maxima([]), 0);
});

test('fechas salteadas tienen racha maxima de uno', () => {
  assert.equal(calcula_racha_maxima(['2026-06-01', '2026-06-05', '2026-06-20']), 1);
});

test('fechas desordenadas y repetidas cuentan una racha correcta', () => {
  assert.equal(calcula_racha_maxima(['2026-06-16', '2026-06-14', '2026-06-15', '2026-06-14']), 3);
});

test('la racha cruza correctamente el fin de ano', () => {
  assert.equal(calcula_racha_maxima(['2026-12-31', '2027-01-01']), 2);
});

test('rechaza fechas que no existen', () => {
  assert.throws(() => calcula_racha_maxima(['2026-02-30']), TypeError);
});

test('rechaza conteos negativos o no enteros', () => {
  assert.throws(() => clasificar_riesgo(-1, 0, 0), TypeError);
  assert.throws(() => clasificar_riesgo(0, 1.5, 0), TypeError);
});