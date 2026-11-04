import { randomBytes, timingSafeEqual } from 'node:crypto';

/* Proteccion CSRF: cada formulario mutador debe devolver el token de su sesion. */
export function crearTokenCsrf() {
  // 32 bytes aleatorios se representan como 64 caracteres hexadecimales.
  return randomBytes(32).toString('hex');
}

export function protegerCsrf(req, res, next) {
  const tokenEnviado = req.body?._csrf;
  const tokenDeSesion = req.session?.csrfToken;

  if (typeof tokenEnviado !== 'string' || typeof tokenDeSesion !== 'string') {
    return res.status(403).render('error', { mensaje: 'La solicitud vencio. Recarga la pagina.' });
  }

  // timingSafeEqual requiere buffers de igual longitud; la longitud se revisa primero.
  const tokenEnviadoBuffer = Buffer.from(tokenEnviado);
  const tokenDeSesionBuffer = Buffer.from(tokenDeSesion);
  const tienenIgualLongitud = tokenEnviadoBuffer.length === tokenDeSesionBuffer.length;
  const sonIguales = tienenIgualLongitud
    && timingSafeEqual(tokenEnviadoBuffer, tokenDeSesionBuffer);
  if (!sonIguales) {
    return res.status(403).render('error', { mensaje: 'La solicitud no es valida.' });
  }

  return next();
}

/* Identidad: la sesion identifica al usuario, pero la base confirma que siga activo. */
export function crearCargarUsuarioActual(consulta) {
  return async function cargarUsuarioActual(req, res, next) {
    if (!req.session.userId) return next();

    try {
      // La sesion identifica la cuenta, pero PostgreSQL confirma que siga activa.
      const cuentasActivas = await consulta(
        'SELECT id, nombre, usuario, rol, foto_data IS NOT NULL AS tiene_foto FROM usuarios WHERE id = $1 AND activo = TRUE LIMIT 1',
        [req.session.userId],
      );

      if (cuentasActivas.length === 0) {
        // La cuenta pudo desactivarse despues de iniciar sesion; se invalida su cookie aqui.
        return req.session.destroy(() => {
          res.clearCookie('asistencia.sid');
          res.redirect('/login');
        });
      }

      req.user = cuentasActivas[0];
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

/* Acceso a rutas: primero se exige sesion y despues se comprueba el rol requerido. */
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
