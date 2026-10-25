import { randomBytes, timingSafeEqual } from 'node:crypto';

export function crearTokenCsrf() {
  return randomBytes(32).toString('hex');
}

export function protegerCsrf(req, res, next) {
  const enviado = req.body?._csrf;
  const guardado = req.session?.csrfToken;

  if (typeof enviado !== 'string' || typeof guardado !== 'string') {
    return res.status(403).render('error', { mensaje: 'La solicitud vencio. Recarga la pagina.' });
  }

  const enviadoBuffer = Buffer.from(enviado);
  const guardadoBuffer = Buffer.from(guardado);
  if (enviadoBuffer.length !== guardadoBuffer.length || !timingSafeEqual(enviadoBuffer, guardadoBuffer)) {
    return res.status(403).render('error', { mensaje: 'La solicitud no es valida.' });
  }

  return next();
}

export function crearCargarUsuarioActual(consulta) {
  return async function cargarUsuarioActual(req, res, next) {
    if (!req.session.userId) return next();

    try {
      const filas = await consulta(
        'SELECT id, nombre, usuario, rol FROM usuarios WHERE id = $1 AND activo = TRUE LIMIT 1',
        [req.session.userId],
      );

      if (filas.length === 0) {
        return req.session.destroy(() => {
          res.clearCookie('asistencia.sid');
          res.redirect('/login');
        });
      }

      req.user = filas[0];
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export function requerirLogin(req, res, next) {
  if (!req.user) return res.redirect('/login');
  return next();
}

export function requerirAdmin(req, res, next) {
  if (!req.user) return res.redirect('/login');
  if (req.user.rol !== 'admin') {
    return res.status(403).render('error', { mensaje: 'No tienes permiso para realizar esa accion.' });
  }
  return next();
}

export function validarId(valor) {
  if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor)) return null;
  const id = Number(valor);
  return Number.isSafeInteger(id) ? id : null;
}