import session from 'express-session';
import { esErrorTransitorio, esperarReintento } from './errores.js';

/*
 * Almacen persistente de sesiones para express-session.
 * PostgreSQL conserva el JSON y la fecha de vencimiento; el temporizador elimina
 * sesiones viejas para que la tabla no crezca indefinidamente.
 */
// La cookie normalmente trae su fecha de expiracion; usamos ocho horas como respaldo.
function calcularFechaExpiracionEnSegundos(datosSesion) {
  if (datosSesion.cookie?.expires) {
    return Math.floor(new Date(datosSesion.cookie.expires).getTime() / 1000);
  }

  // Una sesion sin fecha explicita conserva el mismo limite de ocho horas que la cookie.
  return Math.floor(Date.now() / 1000) + 8 * 60 * 60;
}

// Una sesion con JSON danado se trata como inexistente en lugar de romper la pagina.
function decodificarSesion(datos) {
  try {
    return JSON.parse(datos);
  } catch {
    return null;
  }
}

// Las operaciones del store son idempotentes: repetirlas una vez es seguro.
async function ejecutarConReintento(operacion) {
  try {
    return await operacion();
  } catch (error) {
    if (!esErrorTransitorio(error)) throw error;
    await esperarReintento();
    return operacion();
  }
}

export class PostgresSessionStore extends session.Store {
  constructor(baseDatos, intervaloLimpiezaMs = 15 * 60 * 1000) {
    super();
    this.baseDatos = baseDatos;
    this.temporizadorLimpieza = setInterval(() => {
      this.clearExpired().catch(() => {});
    }, intervaloLimpiezaMs);
    this.temporizadorLimpieza.unref();
  }

  get(idSesion, funcionFinalizacion) {
    ejecutarConReintento(() => this.baseDatos.query(
      'SELECT data FROM sesiones WHERE session_id = $1 AND expires > $2',
      [idSesion, Math.floor(Date.now() / 1000)],
    )).then(({ rows: sesionesEncontradas }) => {
      if (sesionesEncontradas.length === 0) {
        funcionFinalizacion(null, null);
        return;
      }

      // express-session espera el objeto ya decodificado, no el texto JSON de PostgreSQL.
      funcionFinalizacion(null, decodificarSesion(sesionesEncontradas[0].data));
    }).catch(funcionFinalizacion);
  }

  /* Guardar reemplaza los datos; touch solo extiende su vencimiento. */
  set(idSesion, datosSesion, funcionFinalizacion = () => {}) {
    const fechaExpiracion = calcularFechaExpiracionEnSegundos(datosSesion);
    ejecutarConReintento(() => this.baseDatos.query(
      `INSERT INTO sesiones (session_id, expires, data) VALUES ($1, $2, $3)
       ON CONFLICT (session_id) DO UPDATE SET expires = EXCLUDED.expires, data = EXCLUDED.data`,
      [idSesion, fechaExpiracion, JSON.stringify(datosSesion)],
    )).then(() => funcionFinalizacion(null)).catch(funcionFinalizacion);
  }

  touch(idSesion, datosSesion, funcionFinalizacion = () => {}) {
    const fechaExpiracion = calcularFechaExpiracionEnSegundos(datosSesion);

    ejecutarConReintento(() => this.baseDatos.query(
      'UPDATE sesiones SET expires = $1 WHERE session_id = $2',
      [fechaExpiracion, idSesion],
    )).then(() => funcionFinalizacion(null)).catch(funcionFinalizacion);
  }

  destroy(idSesion, funcionFinalizacion = () => {}) {
    ejecutarConReintento(() => this.baseDatos.query(
      'DELETE FROM sesiones WHERE session_id = $1',
      [idSesion],
    )).then(() => funcionFinalizacion(null)).catch(funcionFinalizacion);
  }

  async clearExpired() {
    // expires se guarda como segundos Unix; las sesiones vencidas ya no se pueden reutilizar.
    await ejecutarConReintento(() => this.baseDatos.query(
      'DELETE FROM sesiones WHERE expires <= $1',
      [Math.floor(Date.now() / 1000)],
    ));
  }

  close() {
    clearInterval(this.temporizadorLimpieza);
  }
}
