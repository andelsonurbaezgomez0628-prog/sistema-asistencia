/*
 * Reglas puras de riesgo escolar.
 * No consulta la base de datos: recibe conteos y fechas, y devuelve la racha
 * y el nivel de riesgo para que las rutas puedan guardar o mostrar el resultado.
 */
// Estos umbrales son la regla escolar; se mantienen juntos para que sea facil revisarlos.
const VENTANA_DIAS = 30;
const FALTAS_MEDIO = 3;
const FALTAS_ALTO = 5;
const TARDANZAS_EXTRA = 4;
const RACHA_ALTO = 3;

// Convierte una fecha en dias UTC para comparar dias consecutivos sin zona horaria.
function convertirFechaADiaUtc(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new TypeError('La fecha debe tener formato YYYY-MM-DD.');
  }

  // Fijar UTC evita que una medianoche se convierta en el dia anterior segun la computadora.
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

export function calcula_racha_maxima(fechasAusencia) {
  if (!Array.isArray(fechasAusencia)) {
    throw new TypeError('Las fechas de ausencia deben estar en un arreglo.');
  }
  if (fechasAusencia.length === 0) return 0;

  // Se usan dias UTC para que los cambios de horario no alteren la racha.
  // Quitamos fechas duplicadas y ordenamos antes de contar la secuencia mas larga.
  const diasUtcOrdenados = [...new Set(fechasAusencia.map(convertirFechaADiaUtc))]
    .sort((a, b) => a - b);
  let rachaActual = 1;
  let rachaMaxima = 1;

  for (let indice = 1; indice < diasUtcOrdenados.length; indice += 1) {
    const esDiaConsecutivo = diasUtcOrdenados[indice] === diasUtcOrdenados[indice - 1] + 1;
    if (esDiaConsecutivo) {
      rachaActual += 1;
    } else {
      rachaActual = 1;
    }
    if (rachaActual > rachaMaxima) rachaMaxima = rachaActual;
  }

  return rachaMaxima;
}

/* Clasificacion: tardanzas ajustan el puntaje; la racha tambien puede elevar el nivel. */
export function clasificar_riesgo(faltas, tardanzas, racha) {
  const conteos = [faltas, tardanzas, racha];
  for (const conteo of conteos) {
    if (!Number.isInteger(conteo) || conteo < 0) {
      throw new TypeError('Los conteos de riesgo deben ser enteros no negativos.');
    }
  }

  // Cuatro tardanzas o mas agregan un punto total al puntaje de ausencias.
  // El puntaje combina faltas sin justificar y un punto adicional por tardanzas frecuentes.
  let puntaje = faltas;
  if (tardanzas >= TARDANZAS_EXTRA) puntaje += 1;

  let nivel = 'bajo';
  // La racha alta activa riesgo alto aunque el total de faltas aun sea menor que cinco.
  if (puntaje >= FALTAS_ALTO || racha >= RACHA_ALTO) {
    nivel = 'alto';
  } else if (puntaje >= FALTAS_MEDIO) {
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

  return { nivel, score: puntaje, mensaje };
}
