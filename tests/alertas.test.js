import prueba from 'node:test';
import afirmar from 'node:assert/strict';
import { calcula_racha_maxima, clasificar_riesgo } from '../src/alertas.js';

prueba('sin faltas ni tardanzas queda en nivel bajo', () => {
  afirmar.equal(clasificar_riesgo(0, 0, 0).nivel, 'bajo');
});

prueba('tres faltas generan nivel medio', () => {
  afirmar.equal(clasificar_riesgo(3, 0, 0).nivel, 'medio');
});

prueba('cinco faltas generan nivel alto', () => {
  afirmar.equal(clasificar_riesgo(5, 0, 0).nivel, 'alto');
});

prueba('racha de tres dias genera nivel alto', () => {
  afirmar.equal(clasificar_riesgo(2, 0, 3).nivel, 'alto');
});

prueba('cuatro tardanzas agregan un punto al score', () => {
  afirmar.equal(clasificar_riesgo(2, 4, 0).nivel, 'medio');
});

prueba('tres tardanzas no agregan un punto', () => {
  afirmar.equal(clasificar_riesgo(2, 3, 0).nivel, 'bajo');
});

prueba('sin fechas de ausencia la racha es cero', () => {
  afirmar.equal(calcula_racha_maxima([]), 0);
});

prueba('fechas salteadas tienen racha maxima de uno', () => {
  afirmar.equal(calcula_racha_maxima(['2026-06-01', '2026-06-05', '2026-06-20']), 1);
});

prueba('fechas desordenadas y repetidas cuentan una racha correcta', () => {
  afirmar.equal(calcula_racha_maxima(['2026-06-16', '2026-06-14', '2026-06-15', '2026-06-14']), 3);
});

prueba('la racha cruza correctamente el fin de ano', () => {
  afirmar.equal(calcula_racha_maxima(['2026-12-31', '2027-01-01']), 2);
});

prueba('rechaza fechas que no existen', () => {
  afirmar.throws(() => calcula_racha_maxima(['2026-02-30']), TypeError);
});

prueba('rechaza conteos negativos o no enteros', () => {
  afirmar.throws(() => clasificar_riesgo(-1, 0, 0), TypeError);
  afirmar.throws(() => clasificar_riesgo(0, 1.5, 0), TypeError);
});