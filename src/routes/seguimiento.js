import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, consulta } from '../db.js';
import { calcula_racha_maxima, clasificar_riesgo } from '../alertas.js';
import { crearTokenCsrf, protegerCsrf, requerirLogin, validarId } from '../security.js';

const router = Router();
const estadosPermitidos = new Set(['presente', 'tardanza', 'ausente', 'justificado']);
const nivelesPermitidos = new Set(['bajo', 'medio', 'alto']);
const estadosAlertaPermitidos = new Set(['pendiente', 'atendida']);

router.get('/cuenta', requerirLogin, (req, res) => res.render('cuenta', { error: null }));

router.post('/cuenta/clave', requerirLogin, protegerCsrf, async (req, res, next) => {
  const claveActual = typeof req.body.clave_actual === 'string' ? req.body.clave_actual : '';
  const claveNueva = typeof req.body.clave_nueva === 'string' ? req.body.clave_nueva : '';
  const confirmarClave = typeof req.body.confirmar_clave === 'string' ? req.body.confirmar_clave : '';
  if (claveNueva.length < 4 || claveNueva.length > 200 || claveNueva !== confirmarClave) {
    return res.status(400).render('cuenta', { error: 'La nueva contrasena debe tener al menos 4 caracteres y coincidir.' });
  }

  try {
    const filas = await consulta(
      'SELECT password_hash FROM usuarios WHERE id = $1 AND activo IS TRUE LIMIT 1',
      [req.user.id],
    );
    if (!filas[0] || !(await bcrypt.compare(claveActual, filas[0].password_hash))) {
      return res.status(400).render('cuenta', { error: 'La contrasena actual no es correcta.' });
    }
    const passwordHash = await bcrypt.hash(claveNueva, 12);
    await consulta('UPDATE usuarios SET password_hash = $1 WHERE id = $2 AND activo IS TRUE', [passwordHash, req.user.id]);

    await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
    req.session.userId = req.user.id;
    req.session.csrfToken = crearTokenCsrf();
    req.session.flash = 'Contrasena actualizada.';
    return req.session.save((error) => error ? next(error) : res.redirect('/'));
  } catch (error) {
    return next(error);
  }
});

function esFechaValida(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const fechaUtc = new Date(`${fecha}T00:00:00.000Z`);
  return Number.isFinite(fechaUtc.getTime()) && fechaUtc.toISOString().slice(0, 10) === fecha;
}

async function seccionesDisponibles(usuario) {
  const filtroDocente = usuario.rol === 'docente' ? 'WHERE s.docente_id = $1' : '';
  const valores = usuario.rol === 'docente' ? [usuario.id] : [];
  return consulta(
    `SELECT s.id, s.nombre, c.nombre AS curso
     FROM secciones s INNER JOIN cursos c ON c.id = s.curso_id
     ${filtroDocente} ORDER BY c.nombre, s.nombre`,
    valores,
  );
}

async function calcularAlerta(conexion, idEstudiante) {
  const { rows: [{ hoy }] } = await conexion.query('SELECT CURRENT_DATE AS hoy');
  const { rows: [conteo] } = await conexion.query(
    `SELECT COUNT(*) FILTER (WHERE estado = 'ausente') AS faltas,
       COUNT(*) FILTER (WHERE estado = 'tardanza') AS tardanzas
     FROM asistencia WHERE estudiante_id = $1 AND fecha BETWEEN $2::date - 29 AND $3::date`,
    [idEstudiante, hoy, hoy],
  );
  const { rows: filasFechas } = await conexion.query(
    `SELECT fecha FROM asistencia
     WHERE estudiante_id = $1 AND estado = 'ausente'
       AND fecha BETWEEN $2::date - 29 AND $3::date`,
    [idEstudiante, hoy, hoy],
  );
  const faltas = Number(conteo.faltas || 0);
  const tardanzas = Number(conteo.tardanzas || 0);
  const racha = calcula_racha_maxima(filasFechas.map((fila) => fila.fecha));
  const riesgo = clasificar_riesgo(faltas, tardanzas, racha);
  const { rows: alertasHoy } = await conexion.query(
    `SELECT id FROM alertas
     WHERE estudiante_id = $1 AND fecha_deteccion = $2 AND estado = 'pendiente' LIMIT 1`,
    [idEstudiante, hoy],
  );

  if (alertasHoy.length > 0) {
    await conexion.query(
      'UPDATE alertas SET nivel = $1, faltas_30_dias = $2, racha_maxima = $3, mensaje = $4 WHERE id = $5',
      [riesgo.nivel, faltas, racha, riesgo.mensaje, alertasHoy[0].id],
    );
  }

  if (riesgo.nivel === 'bajo') {
    await conexion.query(
      "UPDATE alertas SET estado = 'atendida' WHERE estudiante_id = $1 AND estado = 'pendiente'",
      [idEstudiante],
    );
  } else if (alertasHoy.length === 0) {
     await conexion.query(
      `INSERT INTO alertas
       (estudiante_id, nivel, faltas_30_dias, racha_maxima, mensaje, fecha_deteccion)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [idEstudiante, riesgo.nivel, faltas, racha, riesgo.mensaje, hoy],
    );
  }

  return riesgo;
}

router.get('/asistencia', requerirLogin, async (req, res, next) => {
  try {
    const secciones = await seccionesDisponibles(req.user);
    const idSeccion = validarId(req.query.seccion) || Number(secciones[0]?.id || 0);
    const { rows: [{ hoy }] } = await db.query('SELECT CURRENT_DATE AS hoy');
    const fecha = esFechaValida(req.query.fecha) ? req.query.fecha : hoy;
    const seccionPermitida = secciones.some((seccion) => Number(seccion.id) === idSeccion);
    if (idSeccion && !seccionPermitida) {
      return res.status(403).render('error', { mensaje: 'No tienes acceso a esa seccion.' });
    }

    let estudiantes = [];
    if (idSeccion && fecha <= hoy) {
      estudiantes = await consulta(
        `SELECT e.id, e.numero_lista, e.nombre, e.apellido, a.estado, a.observacion
         FROM estudiantes e LEFT JOIN asistencia a ON a.estudiante_id = e.id AND a.fecha = $1
         WHERE e.seccion_id = $2 AND e.activo IS TRUE ORDER BY e.apellido, e.nombre`,
        [fecha, idSeccion],
      );
    }

    return res.render('asistencia', { secciones, estudiantes, idSeccion, fecha, hoy });
  } catch (error) {
    return next(error);
  }
});

router.post('/asistencia', requerirLogin, protegerCsrf, async (req, res, next) => {
  const idSeccion = validarId(String(req.body.seccion_id || ''));
  const fecha = req.body.fecha;
  if (!idSeccion || !esFechaValida(fecha)) {
    req.session.flash = 'Revisa la seccion y la fecha de asistencia.';
    return res.redirect('/asistencia');
  }

  const conexion = await db.connect();
  try {
    await conexion.query('BEGIN');
    const { rows: [{ hoy }] } = await conexion.query('SELECT CURRENT_DATE AS hoy');
    if (fecha > hoy) {
      await conexion.query('ROLLBACK');
      req.session.flash = 'No se puede registrar asistencia para una fecha futura.';
      return res.redirect('/asistencia');
    }

    const { rows: secciones } = await conexion.query(
      `SELECT id FROM secciones WHERE id = $1 ${req.user.rol === 'docente' ? 'AND docente_id = $2' : ''}`,
      req.user.rol === 'docente' ? [idSeccion, req.user.id] : [idSeccion],
    );
    if (secciones.length === 0) {
      await conexion.query('ROLLBACK');
      return res.status(403).render('error', { mensaje: 'No tienes acceso a esa seccion.' });
    }

    const { rows: estudiantes } = await conexion.query(
      'SELECT id FROM estudiantes WHERE seccion_id = $1 AND activo IS TRUE',
      [idSeccion],
    );
    // Los campos llegan como estado_<id> y observacion_<id>. No usar
    // corchetes con el id (estado[7]) porque el parser los convierte en
    // arreglo y se pierde la relacion entre estudiante y estado.
    const entradas = [];
    for (const estudiante of estudiantes) {
      const id = String(estudiante.id);
      const estado = req.body[`estado_${id}`];
      const observacion = req.body[`observacion_${id}`];
      if (estado === undefined) {
        await conexion.query('ROLLBACK');
        req.session.flash = 'La lista debe incluir a todos los estudiantes activos de la seccion.';
        return res.redirect(`/asistencia?seccion=${idSeccion}&fecha=${fecha}`);
      }
      if (typeof estado !== 'string' || !estadosPermitidos.has(estado)) {
        await conexion.query('ROLLBACK');
        return res.status(400).render('error', { mensaje: 'La lista contiene un estudiante o estado no permitido.' });
      }
      if (observacion !== undefined && typeof observacion !== 'string') {
        await conexion.query('ROLLBACK');
        return res.status(400).render('error', { mensaje: 'La observacion no es valida.' });
      }
      entradas.push({ id, estado, observacion });
    }

    let conRiesgo = 0;
    for (const { id, estado, observacion } of entradas) {
      const observacionLimpia = (observacion || '').trim().slice(0, 255) || null;
      await conexion.query(
        `INSERT INTO asistencia (estudiante_id, fecha, estado, observacion, creado_por)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (estudiante_id, fecha)
        DO UPDATE SET estado = EXCLUDED.estado, observacion = EXCLUDED.observacion`,
        [Number(id), fecha, estado, observacionLimpia, req.user.id],
      );
      const riesgo = await calcularAlerta(conexion, Number(id));
      if (riesgo.nivel !== 'bajo') conRiesgo += 1;
    }

    await conexion.query('COMMIT');
    req.session.flash = `Asistencia guardada: ${entradas.length} registro(s). Estudiantes con alerta: ${conRiesgo}.`;
    return res.redirect(`/asistencia?seccion=${idSeccion}&fecha=${fecha}`);
  } catch (error) {
    await conexion.query('ROLLBACK');
    return next(error);
  } finally {
    conexion.release();
  }
});

router.get('/alertas', requerirLogin, async (req, res, next) => {
  try {
    const nivel = nivelesPermitidos.has(req.query.nivel) ? req.query.nivel : '';
    const estado = estadosAlertaPermitidos.has(req.query.estado) ? req.query.estado : '';
    const filtros = [];
    const valores = [];
    if (req.user.rol === 'docente') {
      valores.push(req.user.id);
      filtros.push(`s.docente_id = $${valores.length}`);
    }
    if (nivel) {
      valores.push(nivel);
      filtros.push(`a.nivel = $${valores.length}`);
    }
    if (estado) {
      valores.push(estado);
      filtros.push(`a.estado = $${valores.length}`);
    }
    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    const alertas = await consulta(
      `SELECT a.id, a.nivel, a.faltas_30_dias, a.racha_maxima, a.mensaje,
        a.fecha_deteccion, a.estado, e.nombre, e.apellido, e.numero_lista,
        s.nombre AS seccion, c.nombre AS curso
       FROM alertas a
       INNER JOIN estudiantes e ON e.id = a.estudiante_id
       INNER JOIN secciones s ON s.id = e.seccion_id
       INNER JOIN cursos c ON c.id = s.curso_id
       ${where}
       ORDER BY (a.estado = 'pendiente') DESC,
         CASE a.nivel WHEN 'alto' THEN 1 WHEN 'medio' THEN 2 ELSE 3 END,
         a.fecha_deteccion DESC`,
      valores,
    );
    const resumen = { alto: 0, medio: 0, pendientes: 0 };
    for (const alerta of alertas) {
      if (alerta.estado !== 'pendiente') continue;
      resumen.pendientes += 1;
      if (alerta.nivel === 'alto') resumen.alto += 1;
      if (alerta.nivel === 'medio') resumen.medio += 1;
    }
    return res.render('alertas', { alertas, resumen, nivel, estado });
  } catch (error) {
    return next(error);
  }
});

router.post('/alertas/recalcular', requerirLogin, protegerCsrf, async (req, res, next) => {
  if (req.user.rol !== 'admin') {
    return res.status(403).render('error', { mensaje: 'Solo la coordinacion puede recalcular todas las alertas.' });
  }

  const conexion = await db.connect();
  try {
    await conexion.query('BEGIN');
    const { rows: estudiantes } = await conexion.query('SELECT id FROM estudiantes WHERE activo IS TRUE');
    let conRiesgo = 0;
    for (const estudiante of estudiantes) {
      const riesgo = await calcularAlerta(conexion, estudiante.id);
      if (riesgo.nivel !== 'bajo') conRiesgo += 1;
    }
    await conexion.query('COMMIT');
    req.session.flash = `Recalculo terminado: ${conRiesgo} estudiante(s) con riesgo medio o alto.`;
    return res.redirect('/alertas');
  } catch (error) {
    await conexion.query('ROLLBACK');
    return next(error);
  } finally {
    conexion.release();
  }
});

router.post('/alertas/:id/atender', requerirLogin, protegerCsrf, async (req, res, next) => {
  const idAlerta = validarId(req.params.id);
  const nota = typeof req.body.nota === 'string' ? req.body.nota.trim() : '';
  if (!idAlerta || !nota || nota.length > 200) {
    return res.status(400).render('error', { mensaje: 'Indica una nota breve para atender la alerta.' });
  }

  const conexion = await db.connect();
  try {
    await conexion.query('BEGIN');
    const { rows: alertas } = await conexion.query(
      `SELECT a.id, a.mensaje, a.estado, s.docente_id
       FROM alertas a
       INNER JOIN estudiantes e ON e.id = a.estudiante_id
       INNER JOIN secciones s ON s.id = e.seccion_id
      WHERE a.id = $1 FOR UPDATE`,
      [idAlerta],
    );
    const alerta = alertas[0];
    if (!alerta) {
      await conexion.query('ROLLBACK');
      return res.status(404).render('error', { mensaje: 'La alerta no existe.' });
    }
    if (req.user.rol === 'docente' && Number(alerta.docente_id) !== Number(req.user.id)) {
      await conexion.query('ROLLBACK');
      return res.status(403).render('error', { mensaje: 'No tienes acceso a esa alerta.' });
    }
    if (alerta.estado !== 'pendiente') {
      await conexion.query('ROLLBACK');
      req.session.flash = 'La alerta ya fue atendida.';
      return res.redirect('/alertas');
    }

    await conexion.query(
      "UPDATE alertas SET estado = 'atendida', atendida_por = $1, mensaje = $2 WHERE id = $3",
      [req.user.id, `${alerta.mensaje} | ATENDIDA: ${nota}`, idAlerta],
    );
    await conexion.query('COMMIT');
    req.session.flash = 'Alerta atendida correctamente.';
    return res.redirect('/alertas');
  } catch (error) {
    await conexion.query('ROLLBACK');
    return next(error);
  } finally {
    conexion.release();
  }
});

router.get('/reportes', requerirLogin, async (req, res, next) => {
  try {
    const { rows: [{ hoy, iniciodefecto: inicioDefecto }] } = await db.query(
      'SELECT CURRENT_DATE AS hoy, CURRENT_DATE - 29 AS inicioDefecto',
    );
    const desde = esFechaValida(req.query.desde) && req.query.desde <= hoy ? req.query.desde : inicioDefecto;
    const hasta = esFechaValida(req.query.hasta) && req.query.hasta <= hoy ? req.query.hasta : hoy;
    if (desde > hasta) {
      return res.status(400).render('error', { mensaje: 'El inicio del rango debe ser anterior al final.' });
    }
    const idCurso = validarId(typeof req.query.curso === 'string' ? req.query.curso : '');
    const idSeccion = validarId(typeof req.query.seccion === 'string' ? req.query.seccion : '');
    const secciones = await seccionesDisponibles(req.user);
    const cursos = req.user.rol === 'admin'
      ? await consulta('SELECT id, nombre FROM cursos ORDER BY nombre')
      : await consulta(
        `SELECT DISTINCT c.id, c.nombre FROM cursos c
         INNER JOIN secciones s ON s.curso_id = c.id
         WHERE s.docente_id = $1 ORDER BY c.nombre`,
        [req.user.id],
      );

    const valores = [desde, hasta];
    const filtros = ['e.activo IS TRUE'];
    if (req.user.rol === 'docente') {
      valores.push(req.user.id);
      filtros.push(`s.docente_id = $${valores.length}`);
    }
    if (idCurso) {
      valores.push(idCurso);
      filtros.push(`c.id = $${valores.length}`);
    }
    if (idSeccion) {
      if (!secciones.some((seccion) => Number(seccion.id) === idSeccion)) {
        return res.status(403).render('error', { mensaje: 'No tienes acceso a esa seccion.' });
      }
      valores.push(idSeccion);
      filtros.push(`s.id = $${valores.length}`);
    }

    const filas = await consulta(
      `SELECT e.id, e.numero_lista, e.nombre, e.apellido, s.nombre AS seccion,
        c.id AS curso_id, c.nombre AS curso,
        COUNT(a.id) AS dias_registrados,
        COUNT(a.id) FILTER (WHERE a.estado IN ('presente', 'tardanza')) AS asistencias,
        COUNT(a.id) FILTER (WHERE a.estado = 'tardanza') AS tardanzas,
        COUNT(a.id) FILTER (WHERE a.estado = 'ausente') AS ausencias,
        COUNT(a.id) FILTER (WHERE a.estado = 'justificado') AS justificadas
       FROM estudiantes e
       INNER JOIN secciones s ON s.id = e.seccion_id
       INNER JOIN cursos c ON c.id = s.curso_id
      LEFT JOIN asistencia a ON a.estudiante_id = e.id AND a.fecha BETWEEN $1 AND $2
      WHERE ${filtros.join(' AND ')}
       GROUP BY e.id, e.numero_lista, e.nombre, e.apellido, s.nombre, c.id, c.nombre
       ORDER BY c.nombre, s.nombre, e.apellido, e.nombre`,
      valores,
    );

    // Datos para los reportes visuales. Se derivan de las mismas filas
    // filtradas para que las cifras coincidan con la tabla.
    const resumenRegistros = { presentes: 0, tardanzas: 0, ausencias: 0, justificadas: 0 };
    const porCurso = new Map();
    let diasRegistrados = 0;
    let asistenciasTotales = 0;
    for (const fila of filas) {
      const asistencias = Number(fila.asistencias || 0);
      const tardanzas = Number(fila.tardanzas || 0);
      const dias = Number(fila.dias_registrados || 0);
      // asistencias ya suma presente y tardanza; presentes evita contarla dos veces.
      resumenRegistros.presentes += asistencias - tardanzas;
      resumenRegistros.tardanzas += tardanzas;
      resumenRegistros.ausencias += Number(fila.ausencias || 0);
      resumenRegistros.justificadas += Number(fila.justificadas || 0);
      diasRegistrados += dias;
      asistenciasTotales += asistencias;

      const acumulado = porCurso.get(fila.curso_id) || { curso: fila.curso, asistencias: 0, dias: 0 };
      acumulado.asistencias += asistencias;
      acumulado.dias += dias;
      porCurso.set(fila.curso_id, acumulado);
    }
    const totalRegistros = Object.values(resumenRegistros).reduce((total, valor) => total + valor, 0);
    const asistenciaGeneral = diasRegistrados > 0
      ? Math.round((asistenciasTotales / diasRegistrados) * 100)
      : 0;
    const resumenCursos = [...porCurso.values()].map((item) => ({
      curso: item.curso,
      asistencias: item.asistencias,
      dias: item.dias,
      porcentaje: item.dias > 0 ? Math.round((item.asistencias / item.dias) * 100) : 0,
    }));

    return res.render('reportes', {
      filas,
      cursos,
      secciones,
      desde,
      hasta,
      idCurso,
      idSeccion,
      hoy,
      resumenRegistros,
      resumenCursos,
      totalRegistros,
      asistenciaGeneral,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;