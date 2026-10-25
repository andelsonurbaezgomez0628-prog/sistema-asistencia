import pg from 'pg';
import { config } from './config.js';

const { Pool, types } = pg;
types.setTypeParser(1082, (fecha) => fecha);

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: true },
  max: 10,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

export const db = pool;

export async function consulta(sql, valores = []) {
  const resultado = await db.query(sql, valores);
  return resultado.rows;
}