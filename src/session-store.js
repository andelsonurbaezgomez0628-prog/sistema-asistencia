import session from 'express-session';

// La cookie normalmente trae su fecha de expiracion; usamos ocho horas como respaldo.
function calcularExpiracion(sessionData) {
  if (sessionData.cookie?.expires) {
    return Math.floor(new Date(sessionData.cookie.expires).getTime() / 1000);
  }

  return Math.floor(Date.now() / 1000) + 8 * 60 * 60;
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
    this.db.query(
      'SELECT data FROM sesiones WHERE session_id = $1 AND expires > $2',
      [sessionId, Math.floor(Date.now() / 1000)],
    ).then(({ rows }) => {
      callback(null, rows.length ? JSON.parse(rows[0].data) : null);
    }).catch(callback);
  }

  set(sessionId, sessionData, callback = () => {}) {
    const expira = calcularExpiracion(sessionData);
    this.db.query(
      `INSERT INTO sesiones (session_id, expires, data) VALUES ($1, $2, $3)
       ON CONFLICT (session_id) DO UPDATE SET expires = EXCLUDED.expires, data = EXCLUDED.data`,
      [sessionId, expira, JSON.stringify(sessionData)],
    ).then(() => callback(null)).catch(callback);
  }

  touch(sessionId, sessionData, callback = () => {}) {
    const expira = calcularExpiracion(sessionData);

    this.db.query('UPDATE sesiones SET expires = $1 WHERE session_id = $2', [expira, sessionId])
      .then(() => callback(null)).catch(callback);
  }

  destroy(sessionId, callback = () => {}) {
    this.db.query('DELETE FROM sesiones WHERE session_id = $1', [sessionId])
      .then(() => callback(null)).catch(callback);
  }

  async clearExpired() {
    await this.db.query('DELETE FROM sesiones WHERE expires <= $1', [Math.floor(Date.now() / 1000)]);
  }

  close() {
    clearInterval(this.cleanupTimer);
  }
}
