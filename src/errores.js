/*
 * Errores transitorios de PostgreSQL o de red.
 * Neon puede cerrar conexiones inactivas; reintentar una lectura una sola vez
 * evita que ese cierre se convierta en una pagina de error para el docente.
 */
const CODIGOS_TRANSITORIOS = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
  'ETIMEDOUT',
  'ENETUNREACH',
  'ENOTFOUND',
  'EAI_FAIL',
  'EAI_AGAIN',
  '08000',
  '08001',
  '08003',
  '08006',
  '57P01',
  '57P02',
  '57P03',
]);

// pg no siempre asigna codigo a los tiempos de espera; en esos casos solo queda el mensaje.
const MENSAJES_TRANSITORIOS = new Set([
  'Query read timeout',
  'Connection terminated unexpectedly',
  'Connection terminated due to connection timeout',
  'timeout exceeded when trying to connect',
]);

export function esErrorTransitorio(error) {
  if (!error) return false;
  // pg-pool envuelve los fallos de conexion y deja el codigo original en cause.
  if (CODIGOS_TRANSITORIOS.has(error.code) || CODIGOS_TRANSITORIOS.has(error.cause?.code)) return true;
  const mensaje = `${error.message || ''} ${error.cause?.message || ''}`;
  return [...MENSAJES_TRANSITORIOS].some((texto) => mensaje.includes(texto));
}

export function esperarReintento(milisegundos = 120) {
  return new Promise((resolver) => setTimeout(resolver, milisegundos));
}
