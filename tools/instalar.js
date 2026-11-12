import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { config } from '../src/config.js';
import { separarSentenciasSql } from '../src/sql.js';

const carpetaActual = path.dirname(fileURLToPath(import.meta.url));
const carpetaProyecto = path.resolve(carpetaActual, '..');
const esReinstalacionForzada = process.argv.includes('--forzar');
const confirmoReinstalacion = process.argv.includes('--confirmar');
const tablasPrincipales = ['usuarios', 'cursos', 'secciones', 'estudiantes', 'asistencia', 'alertas'];
const tablasParaResumen = [...tablasPrincipales, 'seccion_docentes'];
const { Pool } = pg;
const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: true },
  max: 2,
  connectionTimeoutMillis: 10000,
});

/* --forzar puede borrar datos: exigir tambien --confirmar evita accidentes. */
if (esReinstalacionForzada && !confirmoReinstalacion) {
  console.error('No se borro nada. Para reinstalar de forma destructiva, usa: npm run db:setup -- --forzar --confirmar');
  process.exit(1);
}

// Ejecuta las sentencias de un archivo en el orden en que fueron escritas.
async function ejecutarArchivo(nombre) {
  const rutaArchivo = path.join(carpetaProyecto, 'sql', nombre);
  const contenidoArchivo = await readFile(rutaArchivo, 'utf8');
  const sentencias = separarSentenciasSql(contenidoArchivo);
  for (const sentencia of sentencias) await pool.query(sentencia);
  console.log(`${nombre}: ${sentencias.length} sentencia(s) ejecutadas.`);
}

async function migrarNumeroLista() {
  const { rows: [columnas] } = await pool.query(
    `SELECT
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = 'estudiantes' AND column_name = 'cedula'
       ) AS tiene_cedula,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = 'estudiantes' AND column_name = 'numero_lista'
       ) AS tiene_numero_lista`,
  );

  // Solo migrar esquemas antiguos que tienen cedula y aun no tienen numero_lista.
  if (columnas.tiene_cedula && !columnas.tiene_numero_lista) {
    await ejecutarArchivo('migracion_numero_lista.sql');
    console.log('Migracion aplicada: estudiantes.numero_lista.');
  }
}

async function migrarDocentesSeccion() {
  const { rows: [columnas] } = await pool.query(
    `SELECT
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = 'secciones' AND column_name = 'docente_id'
       ) AS tiene_docente_id,
       EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = current_schema() AND table_name = 'seccion_docentes'
       ) AS tiene_asignaciones` ,
  );

  // La migracion copia primero cada docente actual y luego crea la tabla de asignaciones.
  if (columnas.tiene_docente_id) {
    await ejecutarArchivo('migracion_docentes_seccion.sql');
    console.log('Migracion aplicada: varios docentes por seccion.');
  } else if (!columnas.tiene_asignaciones) {
    throw new Error('Falta la tabla seccion_docentes; revisa el esquema antes de continuar.');
  }
}

/*
 * Instalacion en fases: reconocer el esquema, crear demo solo si corresponde,
 * aplicar migraciones y finalmente mostrar conteos para revisar el resultado.
 */
try {
  // Primero confirmar si existe el esquema completo o si hay una instalacion parcial.
  const { rows: [{ total }] } = await pool.query(
    `SELECT COUNT(*) AS total
     FROM information_schema.tables
     WHERE table_schema = current_schema() AND table_name = ANY($1::text[])`,
    [tablasPrincipales],
  );
  const cantidadTablas = Number(total);
  const esquemaCompleto = cantidadTablas === tablasPrincipales.length;

  if (cantidadTablas > 0 && !esquemaCompleto && !esReinstalacionForzada) {
    throw new Error('La base tiene un esquema parcial. Revisa los datos antes de reinstalar.');
  }
  if (esquemaCompleto && !esReinstalacionForzada) {
    console.log('El esquema ya existe; se conservaron tablas y datos.');
  } else {
    await ejecutarArchivo('schema.sql');
  }

  // Solo crear datos demo en una base nueva o en una reinstalacion confirmada.
  if (!esquemaCompleto || esReinstalacionForzada) {
    const { rows: [{ total: usuarios }] } = await pool.query('SELECT COUNT(*) AS total FROM usuarios');
    if (Number(usuarios) > 0 && !esReinstalacionForzada) {
      throw new Error('La tabla usuarios no esta vacia; se cancelo para evitar duplicar el demo.');
    }
    await ejecutarArchivo('datos_demo.sql');
  } else {
    console.log('Se conservaron los datos existentes; no se duplico la demostracion.');
  }

  // Aplicar cambios compatibles y asegurar que la tabla de sesiones exista.
  await migrarNumeroLista();
  await migrarDocentesSeccion();
  await ejecutarArchivo('migracion_fotos.sql');
  await ejecutarArchivo('migracion_rendimiento.sql');
  await ejecutarArchivo('sesiones.sql');
  if (esReinstalacionForzada) await pool.query('DELETE FROM sesiones');

  for (const tabla of tablasParaResumen) {
    const { rows: [{ total: cantidad }] } = await pool.query(`SELECT COUNT(*) AS total FROM ${tabla}`);
    console.log(`${tabla}: ${cantidad}`);
  }
  const { rows: [{ total: pendientes }] } = await pool.query(
    "SELECT COUNT(*) AS total FROM alertas WHERE estado = 'pendiente'",
  );
  console.log(`Alertas pendientes: ${pendientes}`);
} catch (error) {
  console.error('[instalacion] No se completo:', error.code || error.name || 'error');
  process.exitCode = 1;
} finally {
  await pool.end();
}
