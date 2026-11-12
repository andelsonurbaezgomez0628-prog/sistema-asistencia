import session from 'express-session';
import { esErrorTransitorio, esperarReintento } from './errores.js';

/*
 * Almacen persistente de sesiones para express-session.
 * PostgreSQL conserva el JSON y la fecha de vencimiento; el temporizador elimina
 * sesiones viejas para que la tabla no crezca indefinidamente.
 */
// La cookie normalmente trae su fecha de expiracion; usamos ocho horas como respaldo.
function calcularFechaExpiracionEnSegundos(sessionData) {
  if (sessionData.cookie?.expires) {
    return Math.floor(new Date(sessionData.cookie.expires).getTime() / 1000);
  }

  // Una sesion sin fecha explicita conserva el mismo limite de ocho horas que la cookie.
  return Math.floor(Date.now() / 1000) + 8 * 60 * 60;
}

// Una sesion con JSON danado se trata como inexistente en lugar de romper la pagina.
function decodificarSesion(data) {
  try {
    return JSON.parse(data);
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
  constructor(db, cleanupIntervalMs = 15 * 60 * 1000) {
    super();
    this.db = db;
    this.cleanupTimer = setInterval(() => {
      this.clearExpired().catch(() => {});
    }, cleanupIntervalMs);
    this.cleanupTimer.unref();
  }

  get(sessionId, callback) {
    ejecutarConReintento(() => this.db.query(
      'SELECT data FROM sesiones WHERE session_id = $1 AND expires > $2',
      [sessionId, Math.floor(Date.now() / 1000)],
    )).then(({ rows: sesionesEncontradas }) => {
      if (sesionesEncontradas.length === 0) {
        callback(null, null);
        return;
      }

      // express-session espera el objeto ya decodificado, no el texto JSON de PostgreSQL.
      callback(null, decodificarSesion(sesionesEncontradas[0].data));
    }).catch(callback);
  }

  /* Guardar reemplaza los datos; touch solo extiende su vencimiento. */
  set(sessionId, sessionData, callback = () => {}) {
    const fechaExpiracion = calcularFechaExpiracionEnSegundos(sessionData);
    ejecutarConReintento(() => this.db.query(
      `INSERT INTO sesiones (session_id, expires, data) VALUES ($1, $2, $3)
       ON CONFLICT (session_id) DO UPDATE SET expires = EXCLUDED.expires, data = EXCLUDED.data`,
      [sessionId, fechaExpiracion, JSON.stringify(sessionData)],
    )).then(() => callback(null)).catch(callback);
  }

  touch(sessionId, sessionData, callback = () => {}) {
    const fechaExpiracion = calcularFechaExpiracionEnSegundos(sessionData);

    ejecutarConReintento(() => this.db.query(
      'UPDATE sesiones SET expires = $1 WHERE session_id = $2',
      [fechaExpiracion, sessionId],
    )).then(() => callback(null)).catch(callback);
  }

  destroy(sessionId, callback = () => {}) {
    ejecutarConReintento(() => this.db.query(
      'DELETE FROM sesiones WHERE session_id = $1',
      [sessionId],
    )).then(() => callback(null)).catch(callback);
  }

  async clearExpired() {
    // expires se guarda como segundos Unix; las sesiones vencidas ya no se pueden reutilizar.
    await ejecutarConReintento(() => this.db.query(
      'DELETE FROM sesiones WHERE expires <= $1',
      [Math.floor(Date.now() / 1000)],
    ));
  }

  close() {
    clearInterval(this.cleanupTimer);
  }
}
