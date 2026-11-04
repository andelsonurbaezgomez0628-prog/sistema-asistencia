import pg from 'pg';
import { config } from './config.js';

/*
 * Acceso comun a PostgreSQL.
 * Las rutas usan consulta para obtener filas y db/pool cuando necesitan
 * controlar una transaccion con BEGIN, COMMIT y ROLLBACK.
 */
const { Pool, types } = pg;
// PostgreSQL debe entregar DATE como texto para evitar conversiones de zona horaria en Node.
types.setTypeParser(1082, (fecha) => fecha);

// El pool reutiliza conexiones; TLS comprueba el certificado de PostgreSQL.
export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: true },
  max: 10,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

export const db = pool;

export async function consulta(sql, valores = []) {
  const respuesta = await db.query(sql, valores);
  return respuesta.rows;
}
