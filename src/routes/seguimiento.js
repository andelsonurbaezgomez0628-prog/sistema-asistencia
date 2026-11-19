import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { baseDatos, consulta } from '../db.js';
import { calcula_racha_maxima, clasificar_riesgo } from '../alertas.js';
import { crearTokenCsrf, protegerCsrf, requerirLogin, validarId } from '../security.js';

const router = Router();
const estadosPermitidos = new Set(['presente', 'tardanza', 'ausente', 'justificado']);
const nivelesPermitidos = new Set(['bajo', 'medio', 'alto']);
const estadosAlertaPermitidos = new Set(['pendiente', 'atendida']);
const formatosFotoPermitidos = new Set(['image/jpeg', 'image/png', 'image/webp']);

/* Fotos: comprobar formato y limitar el peso antes de guardar datos binarios. */
function decodificarFoto(urlDatos) {
  if (typeof urlDatos !== 'string' || urlDatos.length > 245000) return null;
  const coincidencia = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(urlDatos);
  if (!coincidencia || !formatosFotoPermitidos.has(coincidencia[1])) return null;
  const datos = Buffer.from(coincidencia[2], 'base64');
  if (datos.length > 180000) return null;
  // El tipo declarado no basta: comprobar la firma evita guardar contenido de otro formato.
  const esJpeg = datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff;
  const esPng = datos.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const esWebp = datos.toString('ascii', 0, 4) === 'RIFF' && datos.toString('ascii', 8, 12) === 'WEBP';
  if (!(coincidencia[1] === 'image/jpeg' && esJpeg)
    && !(coincidencia[1] === 'image/png' && esPng)
    && !(coincidencia[1] === 'image/webp' && esWebp)) return null;
  return { datos, tipo: coincidencia[1] };
}

router.get('/fotos/estudiantes/:id', requerirLogin, async (solicitud, respuesta, siguiente) => {
  const id = validarId(solicitud.params.id);
  if (!id) return respuesta.sendStatus(404);
  try {
    const permiso = solicitud.user.rol === 'docente'
      ? 'AND EXISTS (SELECT 1 FROM seccion_docentes sd WHERE sd.seccion_id = e.seccion_id AND sd.docente_id = $2)'
      : '';
    const valores = solicitud.user.rol === 'docente' ? [id, solicitud.user.id] : [id];
    const filas = await consulta(
      `SELECT e.foto_data, e.foto_tipo FROM estudiantes e WHERE e.id = $1 AND e.activo IS TRUE ${permiso} LIMIT 1`, valores,
    );
    if (!filas[0]?.foto_data) return respuesta.sendStatus(404);
    respuesta.set({ 'Content-Type': filas[0].foto_tipo, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' });
    return respuesta.send(filas[0].foto_data);
  } catch (error) { return siguiente(error); }
});

router.get('/fotos/usuarios/:id', requerirLogin, async (solicitud, respuesta, siguiente) => {
  const id = validarId(solicitud.params.id);
  if (!id || (solicitud.user.rol !== 'admin' && Number(solicitud.user.id) !== id)) return respuesta.sendStatus(404);
  try {
    const filas = await consulta('SELECT foto_data, foto_tipo FROM usuarios WHERE id = $1 AND activo IS TRUE LIMIT 1', [id]);
    if (!filas[0]?.foto_data) return respuesta.sendStatus(404);
    respuesta.set({ 'Content-Type': filas[0].foto_tipo, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' });
    return respuesta.send(filas[0].foto_data);
  } catch (error) { return siguiente(error); }
});

router.post('/fotos/:tipo/:id', requerirLogin, protegerCsrf, async (solicitud, respuesta, siguiente) => {
  const id = validarId(solicitud.params.id);
  const { tipo } = solicitud.params;
  const foto = decodificarFoto(solicitud.body?.foto);
  if (!id || !foto || !['estudiante', 'usuario'].includes(tipo)) {
    return respuesta.status(400).json({ error: 'La imagen no es valida o supera el tamano permitido.' });
  }
  try {
    if (tipo === 'estudiante') {
      const acceso = await consulta(
        `SELECT e.id FROM estudiantes e WHERE e.id = $1 AND e.activo IS TRUE
         AND ($2::text = 'admin' OR EXISTS (
           SELECT 1 FROM seccion_docentes sd WHERE sd.seccion_id = e.seccion_id AND sd.docente_id = $3
         )) LIMIT 1`, [id, solicitud.user.rol, solicitud.user.id],
      );
      if (!acceso.length) return respuesta.status(404).json({ error: 'No se encontro el registro autorizado.' });
      await consulta('UPDATE estudiantes SET foto_data = $1, foto_tipo = $2 WHERE id = $3', [foto.datos, foto.tipo, id]);
    } else {
      const puedeEditar = solicitud.user.rol === 'admin' || Number(solicitud.user.id) === id;
      if (!puedeEditar) return respuesta.status(403).json({ error: 'No tienes permiso para cambiar esa foto.' });
      await consulta('UPDATE usuarios SET foto_data = $1, foto_tipo = $2 WHERE id = $3 AND activo IS TRUE', [foto.datos, foto.tipo, id]);
    }
    return respuesta.json({ ok: true });
  } catch (error) { return siguiente(error); }
});

/*
 * Cuenta personal: permite editar datos propios y cambiar la contrasena.
 * El rol y el estado activo quedan bajo control de administracion.
 */
async function buscarCuentaActual(id) {
  const filas = await consulta(
    'SELECT id, nombre, cedula, usuario, rol, activo, foto_data IS NOT NULL AS tiene_foto FROM usuarios WHERE id = $1 AND activo IS TRUE LIMIT 1',
    [id],
  );
  return filas[0] || null;
}

async function mostrarCuenta(respuesta, id, error = null, valoresPerfil = null) {
  const cuentaActual = await buscarCuentaActual(id);
  if (!cuentaActual) return respuesta.status(404).render('error', { mensaje: 'La cuenta no esta disponible.' });
  return respuesta.status(error ? 400 : 200).render('cuenta', { error, cuentaActual, valoresPerfil });
}

router.get('/cuenta', requerirLogin, async (solicitud, respuesta, siguiente) => {
  try {
    return await mostrarCuenta(respuesta, solicitud.user.id);
  } catch (error) {
    return siguiente(error);
  }
});

router.post('/cuenta/perfil', requerirLogin, protegerCsrf, async (solicitud, respuesta, siguiente) => {
  const nombre = typeof solicitud.body.nombre === 'string' ? solicitud.body.nombre.trim() : '';
  const cedula = typeof solicitud.body.cedula === 'string' ? solicitud.body.cedula.trim() : '';
  const usuario = typeof solicitud.body.usuario === 'string' ? solicitud.body.usuario.trim() : '';
  const claveActual = typeof solicitud.body.clave_actual_perfil === 'string' ? solicitud.body.clave_actual_perfil : '';
  const valoresPerfil = { nombre, cedula, usuario };

  if (!nombre || nombre.length > 120 || !/^[0-9]{7,8}$/.test(cedula)
      || !/^[a-zA-Z0-9._-]{3,50}$/.test(usuario) || !claveActual || claveActual.length > 200) {
    return mostrarCuenta(respuesta, solicitud.user.id, 'Revisa el nombre, la cédula, el usuario y la contraseña actual.', valoresPerfil).catch(siguiente);
  }

  try {
    const filas = await consulta(
      'SELECT password_hash FROM usuarios WHERE id = $1 AND activo IS TRUE LIMIT 1',
      [solicitud.user.id],
    );
    if (!filas[0] || !(await bcrypt.compare(claveActual, filas[0].password_hash))) {
      return await mostrarCuenta(respuesta, solicitud.user.id, 'La contraseña actual no es correcta.', valoresPerfil);
    }

    // El perfil solo cambia datos propios; el rol y la actividad quedan bajo administracion.
    await consulta(
      'UPDATE usuarios SET nombre = $1, cedula = $2, usuario = $3 WHERE id = $4 AND activo IS TRUE',
      [nombre, cedula, usuario, solicitud.user.id],
    );
    solicitud.session.flash = 'Los datos de tu cuenta se actualizaron.';
    return respuesta.redirect('/cuenta');
  } catch (error) {
    if (error.code === '23505') {
      return mostrarCuenta(respuesta, solicitud.user.id, 'Ese usuario o cédula ya pertenece a otra cuenta.', valoresPerfil).catch(siguiente);
    }
    return siguiente(error);
  }
});

router.post('/cuenta/clave', requerirLogin, protegerCsrf, async (solicitud, respuesta, siguiente) => {
  const claveActual = typeof solicitud.body.clave_actual === 'string' ? solicitud.body.clave_actual : '';
  const claveNueva = typeof solicitud.body.clave_nueva === 'string' ? solicitud.body.clave_nueva : '';
  const confirmarClave = typeof solicitud.body.confirmar_clave === 'string' ? solicitud.body.confirmar_clave : '';
  if (claveNueva.length < 4 || claveNueva.length > 200 || claveNueva !== confirmarClave) {
    return mostrarCuenta(respuesta, solicitud.user.id, 'La nueva contraseña debe tener al menos 4 caracteres y coincidir.').catch(siguiente);
  }

  try {
    const filas = await consulta(
      'SELECT password_hash FROM usuarios WHERE id = $1 AND activo IS TRUE LIMIT 1',
      [solicitud.user.id],
    );
    if (!filas[0] || !(await bcrypt.compare(claveActual, filas[0].password_hash))) {
      return await mostrarCuenta(respuesta, solicitud.user.id, 'La contraseña actual no es correcta.');
    }
    const passwordHash = await bcrypt.hash(claveNueva, 12);
    await consulta('UPDATE usuarios SET password_hash = $1 WHERE id = $2 AND activo IS TRUE', [passwordHash, solicitud.user.id]);

    await new Promise((resolver, rechazar) => solicitud.session.regenerate((error) => error ? rechazar(error) : resolver()));
    solicitud.session.userId = solicitud.user.id;
    solicitud.session.csrfToken = crearTokenCsrf();
    solicitud.session.flash = 'Contraseña actualizada.';
    return solicitud.session.save((error) => error ? siguiente(error) : respuesta.redirect('/cuenta'));
  } catch (error) {
    return siguiente(error);
  }
});

function esFechaValida(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const fechaUtc = new Date(`${fecha}T00:00:00.000Z`);
  return Number.isFinite(fechaUtc.getTime()) && fechaUtc.toISOString().slice(0, 10) === fecha;
}

/* Secciones: admin ve todas; docente solo ve las que tiene asignadas. */
// Devuelve todas las secciones a admin y solo las asignadas al docente.
async function seccionesDisponibles(usuario) {
  const filtroDocente = usuario.rol === 'docente'
    ? 'WHERE EXISTS (SELECT 1 FROM seccion_docentes sd WHERE sd.seccion_id = s.id AND sd.docente_id = $1)'
    : '';
  const valores = usuario.rol === 'docente' ? [usuario.id] : [];
  return consulta(
    `SELECT s.id, s.nombre, s.curso_id, c.nombre AS curso
     FROM secciones s INNER JOIN cursos c ON c.id = s.curso_id
     ${filtroDocente} ORDER BY c.nombre, s.nombre`,
    valores,
  );
}

function validarEntradasAsistencia(datosFormulario, estudiantes) {
  const entradas = [];

  for (const estudiante of estudiantes) {
    const idEstudiante = String(estudiante.id);
    const estado = datosFormulario[`estado_${idEstudiante}`];
    const observacion = datosFormulario[`observacion_${idEstudiante}`];

    // La lista esperada viene de PostgreSQL; no se confia en los IDs enviados por el navegador.
    if (estado === undefined) {
      return {
        entradas: [],
        tipoError: 'faltan_estudiantes',
      };
    }
    if (typeof estado !== 'string' || !estadosPermitidos.has(estado)) {
      return {
        entradas: [],
        tipoError: 'estado_no_permitido',
      };
    }
    if (observacion !== undefined && typeof observacion !== 'string') {
      return {
        entradas: [],
        tipoError: 'observacion_no_valida',
      };
    }

    entradas.push({ id: idEstudiante, estado, observacion });
  }

  return { entradas, tipoError: null };
}

/*
 * Alerta de un estudiante: consultar ventana de 30 dias, aplicar la regla pura
 * y actualizar la alerta pendiente del dia dentro de la transaccion actual.
 */
async function calcularAlerta(conexion, idEstudiante, hoy = null) {
  // La fecha se recibe del lote cuando se guardan varios estudiantes; si falta, se consulta.
  const fechaHoy = hoy
    || (await conexion.query('SELECT CURRENT_DATE AS hoy')).rows[0].hoy;

  // Una sola consulta obtiene los conteos y las fechas que explican la racha.
  // Solo se cuenta 'ausente'; una falta justificada no aumenta el riesgo.
  // fecha::text entrega YYYY-MM-DD, el formato que espera la regla pura de rachas.
  const { rows: [conteo] } = await conexion.query(
    `SELECT COUNT(*) FILTER (WHERE estado = 'ausente') AS faltas,
       COUNT(*) FILTER (WHERE estado = 'tardanza') AS tardanzas,
       ARRAY_AGG(fecha::text ORDER BY fecha) FILTER (WHERE estado = 'ausente') AS fechas_ausente
     FROM asistencia WHERE estudiante_id = $1 AND fecha BETWEEN $2::date - 29 AND $3::date`,
    [idEstudiante, fechaHoy, fechaHoy],
  );
  const faltas = Number(conteo.faltas || 0);
  const tardanzas = Number(conteo.tardanzas || 0);
  const racha = calcula_racha_maxima(conteo.fechas_ausente || []);
  // La regla pura decide el nivel; esta funcion solo sincroniza el resultado con la base.
  const riesgo = clasificar_riesgo(faltas, tardanzas, racha);

  // Mantener una alerta pendiente del dia; si no existe, crearla mas abajo.
  const { rows: alertasHoy } = await conexion.query(
    `SELECT id FROM alertas
     WHERE estudiante_id = $1 AND fecha_deteccion = $2 AND estado = 'pendiente' LIMIT 1`,
    [idEstudiante, fechaHoy],
  );

  if (alertasHoy.length > 0) {
    await conexion.query(
      'UPDATE alertas SET nivel = $1, faltas_30_dias = $2, racha_maxima = $3, mensaje = $4 WHERE id = $5',
      [riesgo.nivel, faltas, racha, riesgo.mensaje, alertasHoy[0].id],
    );
  }

  if (riesgo.nivel === 'bajo') {
    // Cuando el riesgo desaparece, cerrar las alertas que seguian pendientes.
    await conexion.query(
      "UPDATE alertas SET estado = 'atendida' WHERE estudiante_id = $1 AND estado = 'pendiente'",
      [idEstudiante],
    );
  } else if (alertasHoy.length === 0) {
    await conexion.query(
      `INSERT INTO alertas
       (estudiante_id, nivel, faltas_30_dias, racha_maxima, mensaje, fecha_deteccion)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [idEstudiante, riesgo.nivel, faltas, racha, riesgo.mensaje, fechaHoy],
    );
  }

  return riesgo;
}

/*
 * Pase de lista: GET prepara la vista; POST vuelve a validar seccion, fecha y
 * lista de estudiantes, luego guarda asistencia y alertas como una transaccion.
 */
router.get('/asistencia', requerirLogin, async (solicitud, respuesta, siguiente) => {
  try {
    // Las secciones y la fecha de negocio son independientes: se piden en paralelo.
    const [secciones, filaHoy] = await Promise.all([
      seccionesDisponibles(solicitud.user),
      consulta('SELECT CURRENT_DATE AS hoy'),
    ]);
    const hoy = filaHoy[0].hoy;
    const idSeccion = validarId(solicitud.query.seccion) || Number(secciones[0]?.id || 0);
    const fecha = esFechaValida(solicitud.query.fecha) ? solicitud.query.fecha : hoy;
    const seccionPermitida = secciones.some((seccion) => Number(seccion.id) === idSeccion);
    if (idSeccion && !seccionPermitida) {
      return respuesta.status(403).render('error', { mensaje: 'No tienes acceso a esa seccion.' });
    }

    let estudiantes = [];
    if (idSeccion && fecha <= hoy) {
      estudiantes = await consulta(
        `SELECT e.id, e.numero_lista, e.nombre, e.apellido, e.foto_data IS NOT NULL AS tiene_foto, a.estado, a.observacion
         FROM estudiantes e LEFT JOIN asistencia a ON a.estudiante_id = e.id AND a.fecha = $1
         WHERE e.seccion_id = $2 AND e.activo IS TRUE ORDER BY e.apellido, e.nombre`,
        [fecha, idSeccion],
      );
    }

    return respuesta.render('asistencia', { secciones, estudiantes, idSeccion, fecha, hoy });
  } catch (error) {
    return siguiente(error);
  }
});

router.post('/asistencia', requerirLogin, protegerCsrf, async (solicitud, respuesta, siguiente) => {
  // Rechazar una seccion o fecha mal formada antes de abrir una transaccion.
  const idSeccion = validarId(String(solicitud.body.seccion_id || ''));
  const fecha = solicitud.body.fecha;
  if (!idSeccion || !esFechaValida(fecha)) {
    solicitud.session.flash = 'Revisa la seccion y la fecha de asistencia.';
    return respuesta.redirect('/asistencia');
  }

  const conexion = await baseDatos.connect();
  try {
    // La fecha se valida contra PostgreSQL para usar el calendario de la escuela.
    await conexion.query('BEGIN');
    const { rows: [{ hoy }] } = await conexion.query('SELECT CURRENT_DATE AS hoy');
    if (fecha > hoy) {
      await conexion.query('ROLLBACK');
      solicitud.session.flash = 'No se puede registrar asistencia para una fecha futura.';
      return respuesta.redirect('/asistencia');
    }

    // Confirmar que el docente esta asignado a la seccion solicitada.
    const { rows: secciones } = await conexion.query(
      `SELECT id FROM secciones WHERE id = $1 ${solicitud.user.rol === 'docente'
        ? 'AND EXISTS (SELECT 1 FROM seccion_docentes sd WHERE sd.seccion_id = secciones.id AND sd.docente_id = $2)'
        : ''}`,
      solicitud.user.rol === 'docente' ? [idSeccion, solicitud.user.id] : [idSeccion],
    );
    if (secciones.length === 0) {
      await conexion.query('ROLLBACK');
      return respuesta.status(403).render('error', { mensaje: 'No tienes acceso a esa seccion.' });
    }

    // Tomar la lista real del servidor y exigir un estado para cada estudiante activo.
    const { rows: estudiantes } = await conexion.query(
      'SELECT id FROM estudiantes WHERE seccion_id = $1 AND activo IS TRUE',
      [idSeccion],
    );
    // Los campos usan estado_<id>; asi el parser no confunde estudiantes con indices de un arreglo.
    const validacionEntradas = validarEntradasAsistencia(solicitud.body, estudiantes);
    if (validacionEntradas.tipoError) {
      await conexion.query('ROLLBACK');

      if (validacionEntradas.tipoError === 'faltan_estudiantes') {
        solicitud.session.flash = 'La lista debe incluir a todos los estudiantes activos de la seccion.';
        return respuesta.redirect(`/asistencia?seccion=${idSeccion}&fecha=${fecha}`);
      }
      if (validacionEntradas.tipoError === 'estado_no_permitido') {
        return respuesta.status(400).render('error', { mensaje: 'La lista contiene un estudiante o estado no permitido.' });
      }
      return respuesta.status(400).render('error', { mensaje: 'La observacion no es valida.' });
    }

    // Guardar todas las marcas en una sola operacion y recalcular alertas dentro de la transaccion.
    const entradas = validacionEntradas.entradas;
    await conexion.query(
      `INSERT INTO asistencia (estudiante_id, fecha, estado, observacion, creado_por)
       SELECT * FROM unnest($1::int[], $2::date[], $3::text[], $4::text[], $5::int[])
       ON CONFLICT (estudiante_id, fecha)
       DO UPDATE SET estado = EXCLUDED.estado, observacion = EXCLUDED.observacion`,
      [
        entradas.map((entrada) => Number(entrada.id)),
        entradas.map(() => fecha),
        entradas.map((entrada) => entrada.estado),
        entradas.map((entrada) => (entrada.observacion || '').trim().slice(0, 255) || null),
        entradas.map(() => solicitud.user.id),
      ],
    );
    let conRiesgo = 0;
    for (const { id } of entradas) {
      const riesgo = await calcularAlerta(conexion, Number(id), hoy);
      if (riesgo.nivel !== 'bajo') conRiesgo += 1;
    }

    // Confirmar al final hace que asistencia y alertas se guarden como una sola operacion.
    await conexion.query('COMMIT');
    solicitud.session.flash = `Asistencia guardada: ${validacionEntradas.entradas.length} registro(s). Estudiantes con alerta: ${conRiesgo}.`;
    return respuesta.redirect(`/asistencia?seccion=${idSeccion}&fecha=${fecha}`);
  } catch (error) {
    await conexion.query('ROLLBACK');
    return siguiente(error);
  } finally {
    conexion.release();
  }
});

/*
 * Alertas: docentes ven las de sus secciones; coordinacion puede recalcular
 * todas y cualquier atencion de alerta requiere permiso y una nota.
 */
router.get('/alertas', requerirLogin, async (solicitud, respuesta, siguiente) => {
  try {
    // Aceptar solo filtros conocidos antes de formar la consulta.
    const nivel = nivelesPermitidos.has(solicitud.query.nivel) ? solicitud.query.nivel : '';
    const estado = estadosAlertaPermitidos.has(solicitud.query.estado) ? solicitud.query.estado : '';
    const filtros = [];
    const valores = [];
    if (solicitud.user.rol === 'docente') {
      valores.push(solicitud.user.id);
      filtros.push(`EXISTS (SELECT 1 FROM seccion_docentes sd WHERE sd.seccion_id = s.id AND sd.docente_id = $${valores.length})`);
    }
    if (nivel) {
      valores.push(nivel);
      filtros.push(`a.nivel = $${valores.length}`);
    }
    if (estado) {
      valores.push(estado);
      filtros.push(`a.estado = $${valores.length}`);
    }
    // Los filtros son condiciones internas; cada valor sigue viajando como parametro SQL.
    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    const alertas = await consulta(
      `SELECT a.id, a.nivel, a.faltas_30_dias, a.racha_maxima, a.mensaje,
        a.fecha_deteccion, a.estado, e.nombre, e.apellido, e.numero_lista, e.foto_data IS NOT NULL AS tiene_foto,
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
    return respuesta.render('alertas', { alertas, resumen, nivel, estado });
  } catch (error) {
    return siguiente(error);
  }
});

router.post('/alertas/recalcular', requerirLogin, protegerCsrf, async (solicitud, respuesta, siguiente) => {
  if (solicitud.user.rol !== 'admin') {
    return respuesta.status(403).render('error', { mensaje: 'Solo la coordinacion puede recalcular todas las alertas.' });
  }

  const conexion = await baseDatos.connect();
  try {
    // Recalcular todas las cuentas activas como una sola operacion confirmable.
    await conexion.query('BEGIN');
    // Una sola lectura de la fecha evita repetirla por cada estudiante.
    const { rows: [{ hoy }] } = await conexion.query('SELECT CURRENT_DATE AS hoy');
    const { rows: estudiantes } = await conexion.query('SELECT id FROM estudiantes WHERE activo IS TRUE');
    let conRiesgo = 0;
    for (const estudiante of estudiantes) {
      const riesgo = await calcularAlerta(conexion, estudiante.id, hoy);
      if (riesgo.nivel !== 'bajo') conRiesgo += 1;
    }
    await conexion.query('COMMIT');
    solicitud.session.flash = `Recalculo terminado: ${conRiesgo} estudiante(s) con riesgo medio o alto.`;
    return respuesta.redirect('/alertas');
  } catch (error) {
    await conexion.query('ROLLBACK');
    return siguiente(error);
  } finally {
    conexion.release();
  }
});

router.post('/alertas/:id/atender', requerirLogin, protegerCsrf, async (solicitud, respuesta, siguiente) => {
  const idAlerta = validarId(solicitud.params.id);
  const nota = typeof solicitud.body.nota === 'string' ? solicitud.body.nota.trim() : '';
  if (!idAlerta || !nota || nota.length > 200) {
    return respuesta.status(400).render('error', { mensaje: 'Indica una nota breve para atender la alerta.' });
  }

  const conexion = await baseDatos.connect();
  try {
    await conexion.query('BEGIN');
    // Bloquear esta alerta mientras se comprueba el permiso y se registra su atencion.
    const { rows: alertas } = await conexion.query(
      `SELECT a.id, a.mensaje, a.estado,
        EXISTS (
          SELECT 1 FROM seccion_docentes sd
          WHERE sd.seccion_id = s.id AND sd.docente_id = $2
        ) AS docente_asignado
       FROM alertas a
       INNER JOIN estudiantes e ON e.id = a.estudiante_id
       INNER JOIN secciones s ON s.id = e.seccion_id
      WHERE a.id = $1 FOR UPDATE`,
      [idAlerta, solicitud.user.id],
    );
    const alerta = alertas[0];
    if (!alerta) {
      await conexion.query('ROLLBACK');
      return respuesta.status(404).render('error', { mensaje: 'La alerta no existe.' });
    }
    if (solicitud.user.rol === 'docente' && !alerta.docente_asignado) {
      await conexion.query('ROLLBACK');
      return respuesta.status(403).render('error', { mensaje: 'No tienes acceso a esa alerta.' });
    }
    if (alerta.estado !== 'pendiente') {
      await conexion.query('ROLLBACK');
      solicitud.session.flash = 'La alerta ya fue atendida.';
      return respuesta.redirect('/alertas');
    }

    await conexion.query(
      "UPDATE alertas SET estado = 'atendida', atendida_por = $1, mensaje = $2 WHERE id = $3",
      [solicitud.user.id, `${alerta.mensaje} | ATENDIDA: ${nota}`, idAlerta],
    );
    await conexion.query('COMMIT');
    solicitud.session.flash = 'Alerta atendida correctamente.';
    return respuesta.redirect('/alertas');
  } catch (error) {
    await conexion.query('ROLLBACK');
    return siguiente(error);
  } finally {
    conexion.release();
  }
});

/*
 * Reportes: normalizar filtros, limitar los datos por permisos y calcular
 * porcentajes y totales con la tardanza incluida como asistencia.
 */
function resumirReportes(filas) {
  const resumenRegistros = { presentes: 0, tardanzas: 0, ausencias: 0, justificadas: 0 };
  const asistenciasPorCurso = new Map();
  let diasRegistrados = 0;
  let asistenciasTotales = 0;

  for (const fila of filas) {
    const asistencias = Number(fila.asistencias || 0);
    const tardanzas = Number(fila.tardanzas || 0);
    const dias = Number(fila.dias_registrados || 0);

    // La consulta ya suma tardanzas dentro de asistencias; restarlas evita contarlas dos veces.
    resumenRegistros.presentes += asistencias - tardanzas;
    resumenRegistros.tardanzas += tardanzas;
    resumenRegistros.ausencias += Number(fila.ausencias || 0);
    resumenRegistros.justificadas += Number(fila.justificadas || 0);
    diasRegistrados += dias;
    asistenciasTotales += asistencias;

    const acumulado = asistenciasPorCurso.get(fila.curso_id)
      || { curso: fila.curso, asistencias: 0, dias: 0 };
    acumulado.asistencias += asistencias;
    acumulado.dias += dias;
    asistenciasPorCurso.set(fila.curso_id, acumulado);
  }

  const totalRegistros = Object.values(resumenRegistros)
    .reduce((total, valor) => total + valor, 0);
  const asistenciaGeneral = diasRegistrados > 0
    ? Math.round((asistenciasTotales / diasRegistrados) * 100)
    : 0;
  const resumenCursos = [...asistenciasPorCurso.values()].map((item) => ({
    curso: item.curso,
    asistencias: item.asistencias,
    dias: item.dias,
    porcentaje: item.dias > 0 ? Math.round((item.asistencias / item.dias) * 100) : 0,
  }));

  return { resumenRegistros, totalRegistros, asistenciaGeneral, resumenCursos };
}

router.get('/reportes/estudiantes/:id', requerirLogin, async (solicitud, respuesta, siguiente) => {
  const idEstudiante = validarId(solicitud.params.id);
  if (!idEstudiante) return respuesta.status(400).render('error', { mensaje: 'El estudiante indicado no es valido.' });
  try {
    const [filaHoy] = await consulta(
      // El alias va en minusculas porque PostgreSQL dobla los nombres sin comillas.
      'SELECT CURRENT_DATE AS hoy, CURRENT_DATE - 29 AS inicio_defecto',
    );
    const { hoy, inicio_defecto: inicioDefecto } = filaHoy;
    const desde = esFechaValida(solicitud.query.desde) && solicitud.query.desde <= hoy ? solicitud.query.desde : inicioDefecto;
    const hasta = esFechaValida(solicitud.query.hasta) && solicitud.query.hasta <= hoy ? solicitud.query.hasta : hoy;
    if (desde > hasta) return respuesta.status(400).render('error', { mensaje: 'El inicio del rango debe ser anterior al final.' });
    const valoresEstudiante = [idEstudiante];
    const permisoDocente = solicitud.user.rol === 'docente'
      ? 'AND EXISTS (SELECT 1 FROM seccion_docentes sd WHERE sd.seccion_id = s.id AND sd.docente_id = $2)'
      : '';
    if (solicitud.user.rol === 'docente') valoresEstudiante.push(solicitud.user.id);
    // Identidad e historial no dependen entre si: se consultan al mismo tiempo.
    const [estudiante, historial] = await Promise.all([
      consulta(
        `SELECT e.id, e.nombre, e.apellido, e.numero_lista, e.foto_data IS NOT NULL AS tiene_foto, s.nombre AS seccion, c.nombre AS curso
         FROM estudiantes e INNER JOIN secciones s ON s.id = e.seccion_id
         INNER JOIN cursos c ON c.id = s.curso_id
         WHERE e.id = $1 AND e.activo IS TRUE ${permisoDocente} LIMIT 1`, valoresEstudiante,
      ),
      consulta(
        `SELECT fecha, estado, observacion FROM asistencia
         WHERE estudiante_id = $1 AND fecha BETWEEN $2 AND $3 ORDER BY fecha DESC`, [idEstudiante, desde, hasta],
      ),
    ]);
    if (!estudiante[0]) return respuesta.status(404).render('error', { mensaje: 'El estudiante no existe o no tienes acceso.' });
    return respuesta.render('reporte-estudiante', { estudiante: estudiante[0], historial, desde, hasta, hoy });
  } catch (error) { return siguiente(error); }
});

router.get('/reportes', requerirLogin, async (solicitud, respuesta, siguiente) => {
  try {
    // La fecha de negocio, las secciones y los cursos no dependen entre si.
    const [filaHoy, secciones, cursos] = await Promise.all([
      consulta('SELECT CURRENT_DATE AS hoy, CURRENT_DATE - 29 AS inicio_defecto'),
      seccionesDisponibles(solicitud.user),
      solicitud.user.rol === 'admin'
        ? consulta('SELECT id, nombre FROM cursos ORDER BY nombre')
        : consulta(
          `SELECT DISTINCT c.id, c.nombre FROM cursos c
           INNER JOIN secciones s ON s.curso_id = c.id
           INNER JOIN seccion_docentes sd ON sd.seccion_id = s.id
           WHERE sd.docente_id = $1 ORDER BY c.nombre`,
          [solicitud.user.id],
        ),
    ]);
    const { hoy, inicio_defecto: inicioDefecto } = filaHoy[0];
    const desde = esFechaValida(solicitud.query.desde) && solicitud.query.desde <= hoy ? solicitud.query.desde : inicioDefecto;
    const hasta = esFechaValida(solicitud.query.hasta) && solicitud.query.hasta <= hoy ? solicitud.query.hasta : hoy;
    if (desde > hasta) {
      return respuesta.status(400).render('error', { mensaje: 'El inicio del rango debe ser anterior al final.' });
    }
    // Limpiar los IDs antes de usarlos; secciones y cursos ya respetan el alcance autorizado.
    const idCurso = validarId(typeof solicitud.query.curso === 'string' ? solicitud.query.curso : '');
    const idSeccion = validarId(typeof solicitud.query.seccion === 'string' ? solicitud.query.seccion : '');

    // Armar condiciones con placeholders para que los filtros no formen SQL libre.
    const valores = [desde, hasta];
    const filtros = ['e.activo IS TRUE'];
    if (solicitud.user.rol === 'docente') {
      valores.push(solicitud.user.id);
      filtros.push(`EXISTS (SELECT 1 FROM seccion_docentes sd WHERE sd.seccion_id = s.id AND sd.docente_id = $${valores.length})`);
    }
    if (idCurso) {
      valores.push(idCurso);
      filtros.push(`c.id = $${valores.length}`);
    }
    if (idSeccion) {
      if (!secciones.some((seccion) => Number(seccion.id) === idSeccion)) {
        return respuesta.status(403).render('error', { mensaje: 'No tienes acceso a esa seccion.' });
      }
      valores.push(idSeccion);
      filtros.push(`s.id = $${valores.length}`);
    }

    const filas = await consulta(
      // Una fila por estudiante; los FILTER cuentan cada estado dentro del rango elegido.
      `SELECT e.id, e.numero_lista, e.nombre, e.apellido, e.foto_data IS NOT NULL AS tiene_foto, s.nombre AS seccion,
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

    // Los graficos y la tabla salen de las mismas filas filtradas.
    const { resumenRegistros, totalRegistros, asistenciaGeneral, resumenCursos } = resumirReportes(filas);

    return respuesta.render('reportes', {
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
    return siguiente(error);
  }
});

export default router;
