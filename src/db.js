import pg from 'pg';
import { configuracion } from './config.js';
import { esErrorTransitorio, esperarReintento } from './errores.js';

/*
 * Acceso comun a PostgreSQL.
 * Las rutas usan consulta para obtener filas y db/pool cuando necesitan
 * controlar una transaccion con BEGIN, COMMIT y ROLLBACK.
 */
const { Pool, types } = pg;
// PostgreSQL debe entregar DATE como texto para evitar conversiones de zona horaria en Node.
types.setTypeParser(1082, (fecha) => fecha);

// El pool reutiliza conexiones; TLS comprueba el certificado de PostgreSQL.
export const grupoConexiones = new Pool({
  connectionString: configuracion.urlBaseDatos,
  ssl: { rejectUnauthorized: true },
  max: 10,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  // Mantener viva la conexion y cortar consultas colgadas evita esperas sin fin.
  keepAlive: true,
  statement_timeout: 15000,
  query_timeout: 15000,
});

export const baseDatos = grupoConexiones;

// Si Neon cierra una conexion inactiva, registrar el codigo sin tumbar el proceso.
grupoConexiones.on('error', (error) => {
  console.error('[asistencia] Conexion inactiva cerrada:', JSON.stringify({
    codigo: error.code || error.name || 'desconocido',
  }));
});

function esLectura(sql) {
  return /^\s*(SELECT|WITH)\b/i.test(sql);
}

async function ejecutarConsulta(sql, valores) {
  const respuesta = await baseDatos.query(sql, valores);
  return respuesta.rows;
}

export async function consulta(sql, valores = []) {
  try {
    return await ejecutarConsulta(sql, valores);
  } catch (error) {
    // Solo las lecturas son seguras de repetir; una escritura podria duplicar datos.
    if (!esLectura(sql) || !esErrorTransitorio(error)) throw error;
    await esperarReintento();
    return ejecutarConsulta(sql, valores);
  }
}
