const VENTANA_DIAS = 30;
const FALTAS_MEDIO = 3;
const FALTAS_ALTO = 5;
const TARDANZAS_EXTRA = 4;
const RACHA_ALTO = 3;

function numeroDeDia(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new TypeError('La fecha debe tener formato YYYY-MM-DD.');
  }

  const milisegundos = Date.parse(`${fecha}T00:00:00.000Z`);
  if (!Number.isFinite(milisegundos)) {
    throw new TypeError('La fecha no es valida.');
  }

  const fechaNormalizada = new Date(milisegundos).toISOString().slice(0, 10);
  if (fechaNormalizada !== fecha) {
    throw new TypeError('La fecha no es valida.');
  }

  return Math.floor(milisegundos / 86400000);
}

export function calcula_racha_maxima(fechas) {
  if (!Array.isArray(fechas)) {
    throw new TypeError('Las fechas de ausencia deben estar en un arreglo.');
  }
  if (fechas.length === 0) return 0;

  // Se usan dias UTC para que los cambios de horario no alteren la racha.
  const dias = [...new Set(fechas.map(numeroDeDia))].sort((a, b) => a - b);
  let rachaActual = 1;
  let rachaMaxima = 1;

  for (let indice = 1; indice < dias.length; indice += 1) {
    if (dias[indice] === dias[indice - 1] + 1) {
      rachaActual += 1;
    } else {
      rachaActual = 1;
    }
    if (rachaActual > rachaMaxima) rachaMaxima = rachaActual;
  }

  return rachaMaxima;
}

export function clasificar_riesgo(faltas, tardanzas, racha) {
  for (const valor of [faltas, tardanzas, racha]) {
    if (!Number.isInteger(valor) || valor < 0) {
      throw new TypeError('Los conteos de riesgo deben ser enteros no negativos.');
    }
  }

  let score = faltas;
  if (tardanzas >= TARDANZAS_EXTRA) score += 1;

  let nivel = 'bajo';
  if (score >= FALTAS_ALTO || racha >= RACHA_ALTO) {
    nivel = 'alto';
  } else if (score >= FALTAS_MEDIO) {
    nivel = 'medio';
  }

  let mensaje;
  if (nivel === 'bajo') {
    mensaje = `Sin riesgo relevante: ${faltas} falta(s) en ${VENTANA_DIAS} dias.`;
  } else {
    mensaje = `Riesgo ${nivel.toUpperCase()}: ${faltas} ausencias sin justificar en ${VENTANA_DIAS} dias`
      + (racha >= 2 ? `, racha maxima de ${racha} dias consecutivos` : '')
      + (tardanzas >= TARDANZAS_EXTRA ? `, ademas de ${tardanzas} tardanzas` : '')
      + '. Se recomienda contactar al representante.';
  }

  return { nivel, score, mensaje };
}