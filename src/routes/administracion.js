import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, consulta } from '../db.js';
import { protegerCsrf, requerirAdmin, validarId } from '../security.js';

const router = Router();
const cedulaValida = (valor) => typeof valor === 'string' && /^[0-9]{7,8}$/.test(valor);
const numeroListaValido = (valor) => typeof valor === 'string' && /^[1-9][0-9]?$/.test(valor) && Number(valor) <= 40;
const textoValido = (valor, maximo) => typeof valor === 'string' && valor.trim().length > 0 && valor.trim().length <= maximo;
const fechaValida = (valor) => {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00.000Z`);
  return Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
};
const anioEscolarValido = (valor) => {
  const partes = typeof valor === 'string' ? /^(\d{4})-(\d{4})$/.exec(valor) : null;
  return partes !== null && Number(partes[2]) === Number(partes[1]) + 1;
};
const ROLES_CUENTA = { docente: 'docente', administrador: 'admin' };
const contarAdminsActivos = async () => {
  const filas = await consulta("SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'admin' AND activo IS TRUE");
  return Number(filas[0].total);
};

function normalizarIdsDocentes(valor) {
  const lista = Array.isArray(valor) ? valor : typeof valor === 'string' ? [valor] : [];
  if (lista.length === 0 || lista.length > 100) return null;
  const ids = lista.map(validarId);
  if (ids.some((id) => id === null) || new Set(ids).size !== ids.length) return null;
  return ids;
}

async function docentesValidos(ids, seccionId = null) {
  const filas = seccionId
    ? await consulta(
      `SELECT u.id FROM usuarios u
       WHERE u.id = ANY($1::integer[]) AND u.rol = 'docente'
         AND (u.activo IS TRUE OR EXISTS (
           SELECT 1 FROM seccion_docentes sd
           WHERE sd.seccion_id = $2 AND sd.docente_id = u.id
         ))`,
      [ids, seccionId],
    )
    : await consulta(
      "SELECT id FROM usuarios WHERE id = ANY($1::integer[]) AND rol = 'docente' AND activo IS TRUE",
      [ids],
    );
  return filas.length === ids.length;
}

async function guardarSeccion({ id, nombre, cursoId, anio, docenteIds }) {
  const conexion = await db.connect();
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

router.use(requerirAdmin);

router.get('/', async (req, res, next) => {
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
        `SELECT e.id, e.numero_lista, e.nombre, e.apellido, e.fecha_nacimiento, e.seccion_id, e.activo,
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
    return res.render('gestion', { cursos, secciones, estudiantes, docentes, administradores });
  } catch (error) {
    return next(error);
  }
});

router.get('/editar/:tipo/:id', async (req, res, next) => {
  const { tipo } = req.params;
  const id = validarId(req.params.id);
  const tablas = {
    seccion: ['secciones', 'SELECT id, nombre, curso_id, anio_escolar FROM secciones WHERE id = $1'],
    estudiante: ['estudiantes', 'SELECT id, numero_lista, nombre, apellido, fecha_nacimiento, seccion_id, activo FROM estudiantes WHERE id = $1'],
    docente: ['usuarios', "SELECT id, nombre, cedula, usuario, activo FROM usuarios WHERE id = $1 AND rol = 'docente'"],
    administrador: ['usuarios', "SELECT id, nombre, cedula, usuario, activo FROM usuarios WHERE id = $1 AND rol = 'admin'"],
  };
  if (!id || !tablas[tipo]) return res.status(404).render('error', { mensaje: 'El registro solicitado no existe.' });

  try {
    const filas = await consulta(tablas[tipo][1], [id]);
    if (filas.length === 0) return res.status(404).render('error', { mensaje: 'El registro solicitado no existe.' });
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
    return res.render('editar', {
      tipo,
      registro: filas[0],
      cursos,
      secciones,
      docentes,
      docentesAsignados: docentesAsignados.map((fila) => Number(fila.docente_id)),
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/editar/:tipo/:id', protegerCsrf, async (req, res, next) => {
  const { tipo } = req.params;
  const id = validarId(req.params.id);
  if (!id) return res.status(400).render('error', { mensaje: 'El identificador no es valido.' });

  try {
    if (tipo === 'seccion') {
      const cursoId = validarId(String(req.body.curso_id || ''));
      const docenteIds = normalizarIdsDocentes(req.body.docente_ids);
      const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
      const anio = typeof req.body.anio_escolar === 'string' ? req.body.anio_escolar.trim() : '';
      if (!cursoId || !docenteIds || !textoValido(nombre, 50) || !anioEscolarValido(anio)) {
        req.session.flash = 'Revisa los datos de la seccion.';
        return res.redirect(`/gestion/editar/seccion/${id}`);
      }
      const curso = await consulta('SELECT id FROM cursos WHERE id = $1', [cursoId]);
      if (!curso.length || !(await docentesValidos(docenteIds, id))) {
        return res.status(400).render('error', { mensaje: 'Curso o docentes no validos.' });
      }
      await guardarSeccion({ id, nombre, cursoId, anio, docenteIds });
    } else if (tipo === 'estudiante') {
      const numeroLista = typeof req.body.numero_lista === 'string' ? req.body.numero_lista.trim() : '';
      const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
      const apellido = typeof req.body.apellido === 'string' ? req.body.apellido.trim() : '';
      const seccionId = validarId(String(req.body.seccion_id || ''));
      const nacimiento = req.body.fecha_nacimiento || null;
      const activo = req.body.activo === '1';
      if (!numeroListaValido(numeroLista) || !textoValido(nombre, 80) || !textoValido(apellido, 80) || !seccionId
          || (nacimiento && !fechaValida(nacimiento))) {
        req.session.flash = 'Revisa los datos del estudiante; el numero de lista debe estar entre 1 y 40.';
        return res.redirect(`/gestion/editar/estudiante/${id}`);
      }
      await consulta(
          `UPDATE estudiantes SET numero_lista = $1, nombre = $2, apellido = $3, fecha_nacimiento = $4, seccion_id = $5, activo = $6 WHERE id = $7`,
        [numeroLista, nombre, apellido, nacimiento, seccionId, activo, id],
      );
    } else if (tipo === 'docente' || tipo === 'administrador') {
      const rol = ROLES_CUENTA[tipo];
      const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
      const cedula = typeof req.body.cedula === 'string' ? req.body.cedula.trim() : '';
      const usuario = typeof req.body.usuario === 'string' ? req.body.usuario.trim() : '';
      const clave = typeof req.body.clave === 'string' ? req.body.clave : '';
      const activo = req.body.activo === '1';
      if (!textoValido(nombre, 120) || !cedulaValida(cedula) || !/^[a-zA-Z0-9._-]{3,50}$/.test(usuario)
          || (clave && clave.length < 4)) {
        req.session.flash = `Revisa los datos del ${tipo}; la clave nueva debe tener al menos 4 caracteres.`;
        return res.redirect(`/gestion/editar/${tipo}/${id}`);
      }
      if (!activo) {
        if (rol === 'admin') {
          if (id === req.user.id) {
            req.session.flash = 'No puedes desactivar tu propia cuenta de administrador.';
            return res.redirect(`/gestion/editar/${tipo}/${id}`);
          }
          if (await contarAdminsActivos() <= 1) {
            req.session.flash = 'Debe quedar al menos un administrador activo.';
            return res.redirect(`/gestion/editar/${tipo}/${id}`);
          }
        } else {
          const asignadas = await consulta('SELECT COUNT(*) AS total FROM seccion_docentes WHERE docente_id = $1', [id]);
          if (Number(asignadas[0].total) > 0) {
            req.session.flash = 'Reasigna primero las secciones antes de desactivar el docente.';
            return res.redirect(`/gestion/editar/${tipo}/${id}`);
          }
        }
      }
      const [cuenta] = await consulta('SELECT id FROM usuarios WHERE id = $1 AND rol = $2', [id, rol]);
      if (!cuenta) return res.status(404).render('error', { mensaje: 'La cuenta no existe.' });
      if (clave) {
        const passwordHash = await bcrypt.hash(clave, 12);
        await consulta(
          `UPDATE usuarios SET nombre = $1, cedula = $2, usuario = $3, password_hash = $4, activo = $5
           WHERE id = $6 AND rol = $7`,
          [nombre, cedula, usuario, passwordHash, activo, id, rol],
        );
      } else {
        await consulta(
          `UPDATE usuarios SET nombre = $1, cedula = $2, usuario = $3, activo = $4
           WHERE id = $5 AND rol = $6`,
          [nombre, cedula, usuario, activo, id, rol],
        );
      }
    } else {
      return res.status(404).render('error', { mensaje: 'El tipo de registro no existe.' });
    }

    req.session.flash = 'Cambios guardados.';
    return res.redirect('/gestion');
  } catch (error) {
    if (error.code === '23505') {
      req.session.flash = tipo === 'estudiante'
        ? 'Ese numero de lista ya esta ocupado en la seccion.'
        : 'La cedula, usuario o nombre ya esta registrado.';
      return res.redirect(`/gestion/editar/${tipo}/${id}`);
    }
    return next(error);
  }
});

router.post('/cursos', protegerCsrf, async (req, res, next) => {
  const id = req.body.id ? validarId(req.body.id) : null;
  const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
  const descripcion = typeof req.body.descripcion === 'string' ? req.body.descripcion.trim() : '';
  if ((req.body.id && !id) || !textoValido(nombre, 100) || descripcion.length > 255) {
    req.session.flash = 'Revisa el nombre y la descripcion del curso.';
    return res.redirect('/gestion');
  }

  try {
    if (id) {
      if (req.body.descripcion === undefined) {
        await consulta('UPDATE cursos SET nombre = $1 WHERE id = $2', [nombre, id]);
      } else {
        await consulta('UPDATE cursos SET nombre = $1, descripcion = $2 WHERE id = $3', [nombre, descripcion || null, id]);
      }
      req.session.flash = 'Curso actualizado.';
    } else {
      await consulta('INSERT INTO cursos (nombre, descripcion) VALUES ($1, $2)', [nombre, descripcion || null]);
      req.session.flash = 'Curso creado.';
    }
    return res.redirect('/gestion');
  } catch (error) {
    if (error.code === '23505') {
      req.session.flash = 'Ya existe un curso con ese nombre.';
      return res.redirect('/gestion');
    }
    return next(error);
  }
});

router.post('/cursos/:id/eliminar', protegerCsrf, async (req, res, next) => {
  const id = validarId(req.params.id);
  if (!id) return res.status(400).render('error', { mensaje: 'El curso indicado no es valido.' });
  try {
    const relaciones = await consulta('SELECT COUNT(*) AS total FROM secciones WHERE curso_id = $1', [id]);
    if (Number(relaciones[0].total) > 0) {
      req.session.flash = 'No se puede eliminar un curso que tenga secciones.';
      return res.redirect('/gestion');
    }
    await consulta('DELETE FROM cursos WHERE id = $1', [id]);
    req.session.flash = 'Curso eliminado.';
    return res.redirect('/gestion');
  } catch (error) {
    return next(error);
  }
});

router.post('/secciones', protegerCsrf, async (req, res, next) => {
  const id = req.body.id ? validarId(req.body.id) : null;
  const cursoId = validarId(String(req.body.curso_id || ''));
  const docenteIds = normalizarIdsDocentes(req.body.docente_ids);
  const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
  const anio = typeof req.body.anio_escolar === 'string' ? req.body.anio_escolar.trim() : '';
  if ((req.body.id && !id) || !cursoId || !docenteIds || !textoValido(nombre, 50) || !anioEscolarValido(anio)) {
    req.session.flash = 'Revisa los datos de la seccion.';
    return res.redirect('/gestion');
  }

  try {
    const cursosEncontrados = await consulta('SELECT id FROM cursos WHERE id = $1', [cursoId]);
    if (cursosEncontrados.length === 0 || !(await docentesValidos(docenteIds, id))) {
      req.session.flash = 'El curso o docente seleccionado no esta activo.';
      return res.redirect('/gestion');
    }
    await guardarSeccion({ id, nombre, cursoId, anio, docenteIds });
    req.session.flash = id ? 'Seccion actualizada.' : 'Seccion creada.';
    return res.redirect('/gestion');
  } catch (error) {
    if (error.code === '23505') {
      req.session.flash = 'Ese nombre de seccion ya existe en el curso.';
      return res.redirect('/gestion');
    }
    return next(error);
  }
});

router.post('/secciones/:id/eliminar', protegerCsrf, async (req, res, next) => {
  const id = validarId(req.params.id);
  if (!id) return res.status(400).render('error', { mensaje: 'La seccion indicada no es valida.' });
  try {
    const relaciones = await consulta('SELECT COUNT(*) AS total FROM estudiantes WHERE seccion_id = $1', [id]);
    if (Number(relaciones[0].total) > 0) {
      req.session.flash = 'No se puede eliminar una seccion que tenga estudiantes.';
      return res.redirect('/gestion');
    }
    await consulta('DELETE FROM secciones WHERE id = $1', [id]);
    req.session.flash = 'Seccion eliminada.';
    return res.redirect('/gestion');
  } catch (error) {
    return next(error);
  }
});

router.post('/estudiantes', protegerCsrf, async (req, res, next) => {
  const id = req.body.id ? validarId(req.body.id) : null;
  const numeroLista = typeof req.body.numero_lista === 'string' ? req.body.numero_lista.trim() : '';
  const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
  const apellido = typeof req.body.apellido === 'string' ? req.body.apellido.trim() : '';
  const seccionId = validarId(String(req.body.seccion_id || ''));
  const nacimiento = req.body.fecha_nacimiento || null;
  if ((req.body.id && !id) || !numeroListaValido(numeroLista) || !textoValido(nombre, 80)
      || !textoValido(apellido, 80) || !seccionId
      || (nacimiento && !fechaValida(nacimiento))) {
    req.session.flash = 'Revisa los datos del estudiante; el numero de lista debe estar entre 1 y 40.';
    return res.redirect('/gestion');
  }

  try {
    const secciones = await consulta('SELECT id FROM secciones WHERE id = $1', [seccionId]);
    if (secciones.length === 0) {
      req.session.flash = 'La seccion seleccionada no existe.';
      return res.redirect('/gestion');
    }
    if (id) {
      await consulta(
        `UPDATE estudiantes SET numero_lista = $1, nombre = $2, apellido = $3, fecha_nacimiento = $4, seccion_id = $5
         WHERE id = $6`,
        [numeroLista, nombre, apellido, nacimiento, seccionId, id],
      );
      req.session.flash = 'Estudiante actualizado.';
    } else {
      await consulta(
        `INSERT INTO estudiantes (numero_lista, nombre, apellido, fecha_nacimiento, seccion_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [numeroLista, nombre, apellido, nacimiento, seccionId],
      );
      req.session.flash = 'Estudiante creado.';
    }
    return res.redirect('/gestion');
  } catch (error) {
    if (error.code === '23505') {
      req.session.flash = 'Ese numero de lista ya esta ocupado en la seccion.';
      return res.redirect('/gestion');
    }
    return next(error);
  }
});

router.post('/estudiantes/:id/desactivar', protegerCsrf, async (req, res, next) => {
  const id = validarId(req.params.id);
  if (!id) return res.status(400).render('error', { mensaje: 'El estudiante indicado no es valido.' });
  try {
    await consulta('UPDATE estudiantes SET activo = FALSE WHERE id = $1', [id]);
    req.session.flash = 'Estudiante desactivado; su historial se conserva.';
    return res.redirect('/gestion');
  } catch (error) {
    return next(error);
  }
});

router.post('/docentes', protegerCsrf, async (req, res, next) => {
  const id = req.body.id ? validarId(req.body.id) : null;
  const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
  const cedula = typeof req.body.cedula === 'string' ? req.body.cedula.trim() : '';
  const usuario = typeof req.body.usuario === 'string' ? req.body.usuario.trim() : '';
  const clave = typeof req.body.clave === 'string' ? req.body.clave : '';
  if ((req.body.id && !id) || !textoValido(nombre, 120) || !cedulaValida(cedula)
      || !/^[a-zA-Z0-9._-]{3,50}$/.test(usuario) || (!id && clave.length < 4)
      || (clave && clave.length < 4)) {
    req.session.flash = 'Revisa los datos; la contrasena debe tener al menos 4 caracteres.';
    return res.redirect('/gestion');
  }

  try {
    if (id) {
      if (clave) {
        const passwordHash = await bcrypt.hash(clave, 12);
        await consulta(
          `UPDATE usuarios SET nombre = $1, cedula = $2, usuario = $3, password_hash = $4
           WHERE id = $5 AND rol = 'docente'`,
          [nombre, cedula, usuario, passwordHash, id],
        );
      } else {
        await consulta(
          `UPDATE usuarios SET nombre = $1, cedula = $2, usuario = $3
           WHERE id = $4 AND rol = 'docente'`,
          [nombre, cedula, usuario, id],
        );
      }
      req.session.flash = 'Docente actualizado.';
    } else {
      const passwordHash = await bcrypt.hash(clave, 12);
      await consulta(
        `INSERT INTO usuarios (nombre, cedula, usuario, password_hash, rol)
         VALUES ($1, $2, $3, $4, 'docente')`,
        [nombre, cedula, usuario, passwordHash],
      );
      req.session.flash = 'Docente creado.';
    }
    return res.redirect('/gestion');
  } catch (error) {
    if (error.code === '23505') {
      req.session.flash = 'La cedula o el usuario ya estan registrados.';
      return res.redirect('/gestion');
    }
    return next(error);
  }
});

router.post('/docentes/:id/desactivar', protegerCsrf, async (req, res, next) => {
  const id = validarId(req.params.id);
  if (!id) return res.status(400).render('error', { mensaje: 'El docente indicado no es valido.' });
  try {
    const secciones = await consulta('SELECT COUNT(*) AS total FROM seccion_docentes WHERE docente_id = $1', [id]);
    if (Number(secciones[0].total) > 0) {
      req.session.flash = 'Reasigna primero las secciones de este docente.';
      return res.redirect('/gestion');
    }
    await consulta("UPDATE usuarios SET activo = FALSE WHERE id = $1 AND rol = 'docente'", [id]);
    req.session.flash = 'Docente desactivado; sus datos historicos se conservan.';
    return res.redirect('/gestion');
  } catch (error) {
    return next(error);
  }
});

router.post('/administradores', protegerCsrf, async (req, res, next) => {
  const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
  const cedula = typeof req.body.cedula === 'string' ? req.body.cedula.trim() : '';
  const usuario = typeof req.body.usuario === 'string' ? req.body.usuario.trim() : '';
  const clave = typeof req.body.clave === 'string' ? req.body.clave : '';
  // El rol nunca se toma del formulario: esta ruta solo crea administradores.
  if (!textoValido(nombre, 120) || !cedulaValida(cedula)
      || !/^[a-zA-Z0-9._-]{3,50}$/.test(usuario) || clave.length < 4) {
    req.session.flash = 'Revisa los datos; la contrasena debe tener al menos 4 caracteres.';
    return res.redirect('/gestion');
  }

  try {
    const passwordHash = await bcrypt.hash(clave, 12);
    await consulta(
      `INSERT INTO usuarios (nombre, cedula, usuario, password_hash, rol)
       VALUES ($1, $2, $3, $4, 'admin')`,
      [nombre, cedula, usuario, passwordHash],
    );
    req.session.flash = 'Administrador creado.';
    return res.redirect('/gestion');
  } catch (error) {
    if (error.code === '23505') {
      req.session.flash = 'La cedula o el usuario ya estan registrados.';
      return res.redirect('/gestion');
    }
    return next(error);
  }
});

router.post('/administradores/:id/desactivar', protegerCsrf, async (req, res, next) => {
  const id = validarId(req.params.id);
  if (!id) return res.status(400).render('error', { mensaje: 'El administrador indicado no es valido.' });
  if (id === req.user.id) {
    req.session.flash = 'No puedes desactivar tu propia cuenta de administrador.';
    return res.redirect('/gestion');
  }
  try {
    const activos = await contarAdminsActivos();
    if (activos <= 1) {
      req.session.flash = 'Debe quedar al menos un administrador activo.';
      return res.redirect('/gestion');
    }
    await consulta("UPDATE usuarios SET activo = FALSE WHERE id = $1 AND rol = 'admin'", [id]);
    req.session.flash = 'Administrador desactivado; sus datos historicos se conservan.';
    return res.redirect('/gestion');
  } catch (error) {
    return next(error);
  }
});

export default router;
