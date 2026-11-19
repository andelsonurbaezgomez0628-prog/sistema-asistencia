import { Router as crearEnrutador } from 'express';
import cifrador from 'bcryptjs';
import { baseDatos, consulta } from '../db.js';
import { protegerCsrf, requerirAdmin, validarId } from '../security.js';

const enrutador = crearEnrutador();

/*
 * Validaciones de formularios de coordinacion.
 * Se ejecutan en el servidor porque cualquier valor enviado desde el navegador
 * puede modificarse antes de llegar a estas rutas.
 */
// Validaciones de los campos que se usan en las pantallas de gestion.
function cedulaValida(valor) {
  return typeof valor === 'string' && /^[0-9]{7,8}$/.test(valor);
}

function numeroListaValido(valor) {
  return typeof valor === 'string'
    && /^[1-9][0-9]?$/.test(valor)
    && Number(valor) <= 40;
}

function textoValido(valor, maximo) {
  if (typeof valor !== 'string') return false;
  const textoLimpio = valor.trim();
  return textoLimpio.length > 0 && textoLimpio.length <= maximo;
}

function fechaValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00.000Z`);
  return Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

function anioEscolarValido(valor) {
  // El periodo escolar debe cubrir dos anos consecutivos, por ejemplo 2026-2027.
  const partes = typeof valor === 'string' ? /^(\d{4})-(\d{4})$/.exec(valor) : null;
  return partes !== null && Number(partes[2]) === Number(partes[1]) + 1;
}

const ROLES_CUENTA = { docente: 'docente', administrador: 'admin' };

async function contarAdminsActivos() {
  const resultado = await consulta("SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'admin' AND activo IS TRUE");
  return Number(resultado[0].total);
}

// Convierte las casillas de docentes en una lista de IDs segura y sin repetidos.
function normalizarIdsDocentes(valor) {
  let lista = [];
  if (Array.isArray(valor)) {
    lista = valor;
  } else if (typeof valor === 'string') {
    lista = [valor];
  }

  if (lista.length === 0 || lista.length > 100) return null;
  const ids = lista.map(validarId);
  // Rechazar repetidos evita insertar dos veces la misma asignacion de seccion.
  if (ids.some((id) => id === null) || new Set(ids).size !== ids.length) return null;
  return ids;
}

async function docentesValidos(ids, seccionId = null) {
  let filas;
  if (seccionId) {
    // Al editar seccion, conservar docentes ya asignados aunque ahora esten inactivos.
    filas = await consulta(
      `SELECT u.id FROM usuarios u
       WHERE u.id = ANY($1::integer[]) AND u.rol = 'docente'
         AND (u.activo IS TRUE OR EXISTS (
           SELECT 1 FROM seccion_docentes sd
           WHERE sd.seccion_id = $2 AND sd.docente_id = u.id
         ))`,
      [ids, seccionId],
    );
  } else {
    filas = await consulta(
      "SELECT id FROM usuarios WHERE id = ANY($1::integer[]) AND rol = 'docente' AND activo IS TRUE",
      [ids],
    );
  }

  return filas.length === ids.length;
}

// Guarda la seccion y sus docentes juntos; si algo falla, no deja cambios parciales.
async function guardarSeccion({ id, nombre, cursoId, anio, docenteIds }) {
  const conexion = await baseDatos.connect();
  try {
    await conexion.query('BEGIN');
    let seccionId = id;
    if (id) {
      const resultado = await conexion.query(
        'UPDATE secciones SET nombre = $1, curso_id = $2, anio_escolar = $3 WHERE id = $4 RETURNING id',
        [nombre, cursoId, anio, id],
      );
      if (resultado.rowCount === 0) throw new Error('La seccion no existe.');
    } else {
      const resultado = await conexion.query(
        'INSERT INTO secciones (nombre, curso_id, anio_escolar) VALUES ($1, $2, $3) RETURNING id',
        [nombre, cursoId, anio],
      );
      seccionId = resultado.rows[0].id;
    }

    // Reemplazar las asignaciones dentro de la transaccion evita perderlas si el INSERT falla.
    await conexion.query('DELETE FROM seccion_docentes WHERE seccion_id = $1', [seccionId]);
    await conexion.query(
      `INSERT INTO seccion_docentes (seccion_id, docente_id)
       SELECT $1, docente_id FROM unnest($2::integer[]) AS seleccion(docente_id)`,
      [seccionId, docenteIds],
    );
    await conexion.query('COMMIT');
    return seccionId;
  } catch (error) {
    await conexion.query('ROLLBACK');
    throw error;
  } finally {
    conexion.release();
  }
}

/* Todo el modulo requiere cuenta activa con rol admin; cada POST valida CSRF. */
enrutador.use(requerirAdmin);

// Inicio de Gestion: carga las listas que usan las pestañas de administracion.
/* Lectura: cargar listas para que la coordinacion pueda revisar y editar registros. */
enrutador.get('/', async (solicitud, respuesta, siguiente) => {
  try {
    const [cursos, secciones, estudiantes, docentes, administradores] = await Promise.all([
      consulta(
        `SELECT c.id, c.nombre, c.descripcion, COUNT(s.id) AS total_secciones
         FROM cursos c LEFT JOIN secciones s ON s.curso_id = c.id
         GROUP BY c.id, c.nombre, c.descripcion ORDER BY c.nombre`,
      ),
      consulta(
        `SELECT s.id, s.nombre, s.anio_escolar, s.curso_id,
          c.nombre AS curso,
          COALESCE((
            SELECT STRING_AGG(u.nombre, ', ' ORDER BY u.nombre)
            FROM seccion_docentes sd INNER JOIN usuarios u ON u.id = sd.docente_id
            WHERE sd.seccion_id = s.id
          ), 'Sin docente asignado') AS docentes,
          (SELECT COUNT(*) FROM estudiantes e WHERE e.seccion_id = s.id AND e.activo IS TRUE) AS total_estudiantes
         FROM secciones s INNER JOIN cursos c ON c.id = s.curso_id
         ORDER BY c.nombre, s.nombre`,
      ),
      consulta(
        `SELECT e.id, e.numero_lista, e.nombre, e.apellido, e.fecha_nacimiento, e.seccion_id, e.activo, e.foto_data IS NOT NULL AS tiene_foto,
          s.nombre AS seccion, c.nombre AS curso
         FROM estudiantes e INNER JOIN secciones s ON s.id = e.seccion_id
         INNER JOIN cursos c ON c.id = s.curso_id ORDER BY e.apellido, e.nombre`,
      ),
      consulta(
        `SELECT id, nombre, cedula, usuario, activo FROM usuarios
         WHERE rol = 'docente' ORDER BY nombre`,
      ),
      consulta(
        `SELECT id, nombre, cedula, usuario, activo FROM usuarios
         WHERE rol = 'admin' ORDER BY nombre`,
      ),
    ]);
    return respuesta.render('gestion', { cursos, secciones, estudiantes, docentes, administradores });
  } catch (error) {
    return siguiente(error);
  }
});

/* Edicion: el tipo selecciona una consulta fija y datos auxiliares permitidos. */
enrutador.get('/editar/:tipo/:id', async (solicitud, respuesta, siguiente) => {
  const { tipo } = solicitud.params;
  const id = validarId(solicitud.params.id);
  // Cada tipo tiene una consulta fija; el nombre del tipo nunca se inserta en SQL.
  const consultaPorTipo = {
    seccion: 'SELECT id, nombre, curso_id, anio_escolar FROM secciones WHERE id = $1',
    estudiante: 'SELECT id, numero_lista, nombre, apellido, fecha_nacimiento, seccion_id, activo, foto_data IS NOT NULL AS tiene_foto FROM estudiantes WHERE id = $1',
    docente: "SELECT id, nombre, cedula, usuario, activo, foto_data IS NOT NULL AS tiene_foto FROM usuarios WHERE id = $1 AND rol = 'docente'",
    administrador: "SELECT id, nombre, cedula, usuario, activo, foto_data IS NOT NULL AS tiene_foto FROM usuarios WHERE id = $1 AND rol = 'admin'",
  };
  if (!id || !consultaPorTipo[tipo]) {
    return respuesta.status(404).render('error', { mensaje: 'El registro solicitado no existe.' });
  }

  try {
    const filas = await consulta(consultaPorTipo[tipo], [id]);
    if (filas.length === 0) return respuesta.status(404).render('error', { mensaje: 'El registro solicitado no existe.' });

    // Cargar listas auxiliares solo para los formularios que las necesitan.
    const [cursos, secciones, docentes, docentesAsignados] = await Promise.all([
      tipo === 'seccion' ? consulta('SELECT id, nombre FROM cursos ORDER BY nombre') : [],
      tipo === 'estudiante' ? consulta('SELECT s.id, s.nombre, c.nombre AS curso FROM secciones s INNER JOIN cursos c ON c.id = s.curso_id ORDER BY c.nombre, s.nombre') : [],
      tipo === 'seccion'
        ? consulta(
          `SELECT u.id, u.nombre, u.activo FROM usuarios u
           WHERE u.rol = 'docente' AND (u.activo IS TRUE OR EXISTS (
             SELECT 1 FROM seccion_docentes sd WHERE sd.seccion_id = $1 AND sd.docente_id = u.id
           )) ORDER BY u.nombre`,
          [id],
        )
        : [],
      tipo === 'seccion'
        ? consulta('SELECT docente_id FROM seccion_docentes WHERE seccion_id = $1', [id])
        : [],
    ]);
    return respuesta.render('editar', {
      tipo,
      registro: filas[0],
      cursos,
      secciones,
      docentes,
      docentesAsignados: docentesAsignados.map((fila) => Number(fila.docente_id)),
    });
  } catch (error) {
    return siguiente(error);
  }
});

/* Guardado de cambios: validar campos y relaciones antes de actualizar la tabla correspondiente. */
enrutador.post('/editar/:tipo/:id', protegerCsrf, async (solicitud, respuesta, siguiente) => {
  const { tipo } = solicitud.params;
  const id = validarId(solicitud.params.id);
  if (!id) return respuesta.status(400).render('error', { mensaje: 'El identificador no es valido.' });

  try {
    // El tipo define que campos validar y que tabla se actualiza.
    if (tipo === 'seccion') {
      // La seccion necesita un curso existente y docentes activos o ya asignados.
      const cursoId = validarId(String(solicitud.body.curso_id || ''));
      const docenteIds = normalizarIdsDocentes(solicitud.body.docente_ids);
      const nombre = typeof solicitud.body.nombre === 'string' ? solicitud.body.nombre.trim() : '';
      const anio = typeof solicitud.body.anio_escolar === 'string' ? solicitud.body.anio_escolar.trim() : '';
      if (!cursoId || !docenteIds || !textoValido(nombre, 50) || !anioEscolarValido(anio)) {
        solicitud.session.flash = 'Revisa los datos de la seccion.';
        return respuesta.redirect(`/gestion/editar/seccion/${id}`);
      }
      const curso = await consulta('SELECT id FROM cursos WHERE id = $1', [cursoId]);
      if (!curso.length || !(await docentesValidos(docenteIds, id))) {
        return respuesta.status(400).render('error', { mensaje: 'Curso o docentes no validos.' });
      }
      await guardarSeccion({ id, nombre, cursoId, anio, docenteIds });
    } else if (tipo === 'estudiante') {
      // El numero de lista debe ser unico dentro de la seccion.
      const numeroLista = typeof solicitud.body.numero_lista === 'string' ? solicitud.body.numero_lista.trim() : '';
      const nombre = typeof solicitud.body.nombre === 'string' ? solicitud.body.nombre.trim() : '';
      const apellido = typeof solicitud.body.apellido === 'string' ? solicitud.body.apellido.trim() : '';
      const seccionId = validarId(String(solicitud.body.seccion_id || ''));
      const nacimiento = solicitud.body.fecha_nacimiento || null;
      const activo = solicitud.body.activo === '1';
      if (!numeroListaValido(numeroLista) || !textoValido(nombre, 80) || !textoValido(apellido, 80) || !seccionId
          || (nacimiento && !fechaValida(nacimiento))) {
        solicitud.session.flash = 'Revisa los datos del estudiante; el numero de lista debe estar entre 1 y 40.';
        return respuesta.redirect(`/gestion/editar/estudiante/${id}`);
      }
      await consulta(
        `UPDATE estudiantes SET numero_lista = $1, nombre = $2, apellido = $3,
          fecha_nacimiento = $4, seccion_id = $5, activo = $6 WHERE id = $7`,
        [numeroLista, nombre, apellido, nacimiento, seccionId, activo, id],
      );
    } else if (tipo === 'docente' || tipo === 'administrador') {
      // La ruta determina el rol; solo se reemplaza el hash si se envio una clave nueva.
      const rol = ROLES_CUENTA[tipo];
      const nombre = typeof solicitud.body.nombre === 'string' ? solicitud.body.nombre.trim() : '';
      const cedula = typeof solicitud.body.cedula === 'string' ? solicitud.body.cedula.trim() : '';
      const usuario = typeof solicitud.body.usuario === 'string' ? solicitud.body.usuario.trim() : '';
      const clave = typeof solicitud.body.clave === 'string' ? solicitud.body.clave : '';
      const activo = solicitud.body.activo === '1';
      if (!textoValido(nombre, 120) || !cedulaValida(cedula) || !/^[a-zA-Z0-9._-]{3,50}$/.test(usuario)
          || (clave && clave.length < 4)) {
        solicitud.session.flash = `Revisa los datos del ${tipo}; la clave nueva debe tener al menos 4 caracteres.`;
        return respuesta.redirect(`/gestion/editar/${tipo}/${id}`);
      }
      if (!activo) {
        if (rol === 'admin') {
          if (id === solicitud.user.id) {
            solicitud.session.flash = 'No puedes desactivar tu propia cuenta de administrador.';
            return respuesta.redirect(`/gestion/editar/${tipo}/${id}`);
          }
          if (await contarAdminsActivos() <= 1) {
            solicitud.session.flash = 'Debe quedar al menos un administrador activo.';
            return respuesta.redirect(`/gestion/editar/${tipo}/${id}`);
          }
        } else {
          const asignadas = await consulta('SELECT COUNT(*) AS total FROM seccion_docentes WHERE docente_id = $1', [id]);
          if (Number(asignadas[0].total) > 0) {
            solicitud.session.flash = 'Reasigna primero las secciones antes de desactivar el docente.';
            return respuesta.redirect(`/gestion/editar/${tipo}/${id}`);
          }
        }
      }
      const [cuenta] = await consulta('SELECT id FROM usuarios WHERE id = $1 AND rol = $2', [id, rol]);
      if (!cuenta) return respuesta.status(404).render('error', { mensaje: 'La cuenta no existe.' });
      if (clave) {
        const hashContrasena = await cifrador.hash(clave, 12);
        await consulta(
          `UPDATE usuarios SET nombre = $1, cedula = $2, usuario = $3, password_hash = $4, activo = $5
           WHERE id = $6 AND rol = $7`,
          [nombre, cedula, usuario, hashContrasena, activo, id, rol],
        );
      } else {
        await consulta(
          `UPDATE usuarios SET nombre = $1, cedula = $2, usuario = $3, activo = $4
           WHERE id = $5 AND rol = $6`,
          [nombre, cedula, usuario, activo, id, rol],
        );
      }
    } else {
      return respuesta.status(404).render('error', { mensaje: 'El tipo de registro no existe.' });
    }

    solicitud.session.flash = 'Cambios guardados.';
    return respuesta.redirect('/gestion');
  } catch (error) {
    if (error.code === '23505') {
      solicitud.session.flash = tipo === 'estudiante'
        ? 'Ese numero de lista ya esta ocupado en la seccion.'
        : 'La cedula, usuario o nombre ya esta registrado.';
      return respuesta.redirect(`/gestion/editar/${tipo}/${id}`);
    }
    return siguiente(error);
  }
});

/* Cursos y secciones: no borrar elementos que aun tengan estudiantes o historial asociado. */
enrutador.post('/cursos', protegerCsrf, async (solicitud, respuesta, siguiente) => {
  const id = solicitud.body.id ? validarId(solicitud.body.id) : null;
  const nombre = typeof solicitud.body.nombre === 'string' ? solicitud.body.nombre.trim() : '';
  const descripcion = typeof solicitud.body.descripcion === 'string' ? solicitud.body.descripcion.trim() : '';
  if ((solicitud.body.id && !id) || !textoValido(nombre, 100) || descripcion.length > 255) {
    solicitud.session.flash = 'Revisa el nombre y la descripcion del curso.';
    return respuesta.redirect('/gestion');
  }

  try {
    if (id) {
      if (solicitud.body.descripcion === undefined) {
        await consulta('UPDATE cursos SET nombre = $1 WHERE id = $2', [nombre, id]);
      } else {
        await consulta('UPDATE cursos SET nombre = $1, descripcion = $2 WHERE id = $3', [nombre, descripcion || null, id]);
      }
      solicitud.session.flash = 'Curso actualizado.';
    } else {
      await consulta('INSERT INTO cursos (nombre, descripcion) VALUES ($1, $2)', [nombre, descripcion || null]);
      solicitud.session.flash = 'Curso creado.';
    }
    return respuesta.redirect('/gestion');
  } catch (error) {
    if (error.code === '23505') {
      solicitud.session.flash = 'Ya existe un curso con ese nombre.';
      return respuesta.redirect('/gestion');
    }
    return siguiente(error);
  }
});

enrutador.post('/cursos/:id/eliminar', protegerCsrf, async (solicitud, respuesta, siguiente) => {
  const id = validarId(solicitud.params.id);
  if (!id) return respuesta.status(400).render('error', { mensaje: 'El curso indicado no es valido.' });
  try {
    const relaciones = await consulta('SELECT COUNT(*) AS total FROM secciones WHERE curso_id = $1', [id]);
    if (Number(relaciones[0].total) > 0) {
      solicitud.session.flash = 'No se puede eliminar un curso que tenga secciones.';
      return respuesta.redirect('/gestion');
    }
    await consulta('DELETE FROM cursos WHERE id = $1', [id]);
    solicitud.session.flash = 'Curso eliminado.';
    return respuesta.redirect('/gestion');
  } catch (error) {
    return siguiente(error);
  }
});

enrutador.post('/secciones', protegerCsrf, async (solicitud, respuesta, siguiente) => {
  const id = solicitud.body.id ? validarId(solicitud.body.id) : null;
  const cursoId = validarId(String(solicitud.body.curso_id || ''));
  const docenteIds = normalizarIdsDocentes(solicitud.body.docente_ids);
  const nombre = typeof solicitud.body.nombre === 'string' ? solicitud.body.nombre.trim() : '';
  const anio = typeof solicitud.body.anio_escolar === 'string' ? solicitud.body.anio_escolar.trim() : '';
  if ((solicitud.body.id && !id) || !cursoId || !docenteIds || !textoValido(nombre, 50) || !anioEscolarValido(anio)) {
    solicitud.session.flash = 'Revisa los datos de la seccion.';
    return respuesta.redirect('/gestion');
  }

  try {
    const cursosEncontrados = await consulta('SELECT id FROM cursos WHERE id = $1', [cursoId]);
    if (cursosEncontrados.length === 0 || !(await docentesValidos(docenteIds, id))) {
      solicitud.session.flash = 'El curso o docente seleccionado no esta activo.';
      return respuesta.redirect('/gestion');
    }
    await guardarSeccion({ id, nombre, cursoId, anio, docenteIds });
    solicitud.session.flash = id ? 'Seccion actualizada.' : 'Seccion creada.';
    return respuesta.redirect('/gestion');
  } catch (error) {
    if (error.code === '23505') {
      solicitud.session.flash = 'Ese nombre de seccion ya existe en el curso.';
      return respuesta.redirect('/gestion');
    }
    return siguiente(error);
  }
});

enrutador.post('/secciones/:id/eliminar', protegerCsrf, async (solicitud, respuesta, siguiente) => {
  const id = validarId(solicitud.params.id);
  if (!id) return respuesta.status(400).render('error', { mensaje: 'La seccion indicada no es valida.' });
  try {
    const relaciones = await consulta('SELECT COUNT(*) AS total FROM estudiantes WHERE seccion_id = $1', [id]);
    if (Number(relaciones[0].total) > 0) {
      solicitud.session.flash = 'No se puede eliminar una seccion que tenga estudiantes.';
      return respuesta.redirect('/gestion');
    }
    await consulta('DELETE FROM secciones WHERE id = $1', [id]);
    solicitud.session.flash = 'Seccion eliminada.';
    return respuesta.redirect('/gestion');
  } catch (error) {
    return siguiente(error);
  }
});

/* Estudiantes: desactivar conserva asistencia y alertas que ya forman parte del historial. */
enrutador.post('/estudiantes', protegerCsrf, async (solicitud, respuesta, siguiente) => {
  const id = solicitud.body.id ? validarId(solicitud.body.id) : null;
  const numeroLista = typeof solicitud.body.numero_lista === 'string' ? solicitud.body.numero_lista.trim() : '';
  const nombre = typeof solicitud.body.nombre === 'string' ? solicitud.body.nombre.trim() : '';
  const apellido = typeof solicitud.body.apellido === 'string' ? solicitud.body.apellido.trim() : '';
  const seccionId = validarId(String(solicitud.body.seccion_id || ''));
  const nacimiento = solicitud.body.fecha_nacimiento || null;
  if ((solicitud.body.id && !id) || !numeroListaValido(numeroLista) || !textoValido(nombre, 80)
      || !textoValido(apellido, 80) || !seccionId
      || (nacimiento && !fechaValida(nacimiento))) {
    solicitud.session.flash = 'Revisa los datos del estudiante; el numero de lista debe estar entre 1 y 40.';
    return respuesta.redirect('/gestion');
  }

  try {
    const secciones = await consulta('SELECT id FROM secciones WHERE id = $1', [seccionId]);
    if (secciones.length === 0) {
      solicitud.session.flash = 'La seccion seleccionada no existe.';
      return respuesta.redirect('/gestion');
    }
    if (id) {
      await consulta(
        `UPDATE estudiantes SET numero_lista = $1, nombre = $2, apellido = $3, fecha_nacimiento = $4, seccion_id = $5
         WHERE id = $6`,
        [numeroLista, nombre, apellido, nacimiento, seccionId, id],
      );
      solicitud.session.flash = 'Estudiante actualizado.';
    } else {
      await consulta(
        `INSERT INTO estudiantes (numero_lista, nombre, apellido, fecha_nacimiento, seccion_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [numeroLista, nombre, apellido, nacimiento, seccionId],
      );
      solicitud.session.flash = 'Estudiante creado.';
    }
    return respuesta.redirect('/gestion');
  } catch (error) {
    if (error.code === '23505') {
      solicitud.session.flash = 'Ese numero de lista ya esta ocupado en la seccion.';
      return respuesta.redirect('/gestion');
    }
    return siguiente(error);
  }
});

enrutador.post('/estudiantes/:id/desactivar', protegerCsrf, async (solicitud, respuesta, siguiente) => {
  const id = validarId(solicitud.params.id);
  if (!id) return respuesta.status(400).render('error', { mensaje: 'El estudiante indicado no es valido.' });
  try {
    await consulta('UPDATE estudiantes SET activo = FALSE WHERE id = $1', [id]);
    solicitud.session.flash = 'Estudiante desactivado; su historial se conserva.';
    return respuesta.redirect('/gestion');
  } catch (error) {
    return siguiente(error);
  }
});

/* Personal: guardar contrasenas con hash; el rol lo determina la ruta, no el formulario. */
enrutador.post('/docentes', protegerCsrf, async (solicitud, respuesta, siguiente) => {
  const id = solicitud.body.id ? validarId(solicitud.body.id) : null;
  const nombre = typeof solicitud.body.nombre === 'string' ? solicitud.body.nombre.trim() : '';
  const cedula = typeof solicitud.body.cedula === 'string' ? solicitud.body.cedula.trim() : '';
  const usuario = typeof solicitud.body.usuario === 'string' ? solicitud.body.usuario.trim() : '';
  const clave = typeof solicitud.body.clave === 'string' ? solicitud.body.clave : '';
  if ((solicitud.body.id && !id) || !textoValido(nombre, 120) || !cedulaValida(cedula)
      || !/^[a-zA-Z0-9._-]{3,50}$/.test(usuario) || (!id && clave.length < 4)
      || (clave && clave.length < 4)) {
    solicitud.session.flash = 'Revisa los datos; la contrasena debe tener al menos 4 caracteres.';
    return respuesta.redirect('/gestion');
  }

  try {
    if (id) {
      if (clave) {
        const hashContrasena = await cifrador.hash(clave, 12);
        await consulta(
          `UPDATE usuarios SET nombre = $1, cedula = $2, usuario = $3, password_hash = $4
           WHERE id = $5 AND rol = 'docente'`,
          [nombre, cedula, usuario, hashContrasena, id],
        );
      } else {
        await consulta(
          `UPDATE usuarios SET nombre = $1, cedula = $2, usuario = $3
           WHERE id = $4 AND rol = 'docente'`,
          [nombre, cedula, usuario, id],
        );
      }
      solicitud.session.flash = 'Docente actualizado.';
    } else {
      const hashContrasena = await cifrador.hash(clave, 12);
      await consulta(
        `INSERT INTO usuarios (nombre, cedula, usuario, password_hash, rol)
         VALUES ($1, $2, $3, $4, 'docente')`,
        [nombre, cedula, usuario, hashContrasena],
      );
      solicitud.session.flash = 'Docente creado.';
    }
    return respuesta.redirect('/gestion');
  } catch (error) {
    if (error.code === '23505') {
      solicitud.session.flash = 'La cedula o el usuario ya estan registrados.';
      return respuesta.redirect('/gestion');
    }
    return siguiente(error);
  }
});

enrutador.post('/docentes/:id/desactivar', protegerCsrf, async (solicitud, respuesta, siguiente) => {
  const id = validarId(solicitud.params.id);
  if (!id) return respuesta.status(400).render('error', { mensaje: 'El docente indicado no es valido.' });
  try {
    const secciones = await consulta('SELECT COUNT(*) AS total FROM seccion_docentes WHERE docente_id = $1', [id]);
    if (Number(secciones[0].total) > 0) {
      solicitud.session.flash = 'Reasigna primero las secciones de este docente.';
      return respuesta.redirect('/gestion');
    }
    await consulta("UPDATE usuarios SET activo = FALSE WHERE id = $1 AND rol = 'docente'", [id]);
    solicitud.session.flash = 'Docente desactivado; sus datos historicos se conservan.';
    return respuesta.redirect('/gestion');
  } catch (error) {
    return siguiente(error);
  }
});

enrutador.post('/administradores', protegerCsrf, async (solicitud, respuesta, siguiente) => {
  const nombre = typeof solicitud.body.nombre === 'string' ? solicitud.body.nombre.trim() : '';
  const cedula = typeof solicitud.body.cedula === 'string' ? solicitud.body.cedula.trim() : '';
  const usuario = typeof solicitud.body.usuario === 'string' ? solicitud.body.usuario.trim() : '';
  const clave = typeof solicitud.body.clave === 'string' ? solicitud.body.clave : '';
  // El rol nunca se toma del formulario: esta ruta solo crea administradores.
  if (!textoValido(nombre, 120) || !cedulaValida(cedula)
      || !/^[a-zA-Z0-9._-]{3,50}$/.test(usuario) || clave.length < 4) {
    solicitud.session.flash = 'Revisa los datos; la contrasena debe tener al menos 4 caracteres.';
    return respuesta.redirect('/gestion');
  }

  try {
    const hashContrasena = await cifrador.hash(clave, 12);
    await consulta(
      `INSERT INTO usuarios (nombre, cedula, usuario, password_hash, rol)
       VALUES ($1, $2, $3, $4, 'admin')`,
      [nombre, cedula, usuario, hashContrasena],
    );
    solicitud.session.flash = 'Administrador creado.';
    return respuesta.redirect('/gestion');
  } catch (error) {
    if (error.code === '23505') {
      solicitud.session.flash = 'La cedula o el usuario ya estan registrados.';
      return respuesta.redirect('/gestion');
    }
    return siguiente(error);
  }
});

enrutador.post('/administradores/:id/desactivar', protegerCsrf, async (solicitud, respuesta, siguiente) => {
  const id = validarId(solicitud.params.id);
  if (!id) return respuesta.status(400).render('error', { mensaje: 'El administrador indicado no es valido.' });
  if (id === solicitud.user.id) {
    solicitud.session.flash = 'No puedes desactivar tu propia cuenta de administrador.';
    return respuesta.redirect('/gestion');
  }
  try {
    const activos = await contarAdminsActivos();
    if (activos <= 1) {
      solicitud.session.flash = 'Debe quedar al menos un administrador activo.';
      return respuesta.redirect('/gestion');
    }
    await consulta("UPDATE usuarios SET activo = FALSE WHERE id = $1 AND rol = 'admin'", [id]);
    solicitud.session.flash = 'Administrador desactivado; sus datos historicos se conservan.';
    return respuesta.redirect('/gestion');
  } catch (error) {
    return siguiente(error);
  }
});

export default enrutador;
