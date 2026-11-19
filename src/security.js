import { randomBytes, timingSafeEqual } from 'node:crypto';

/* Proteccion CSRF: cada formulario mutador debe devolver el token de su sesion. */
export function crearTokenCsrf() {
  // 32 bytes aleatorios se representan como 64 caracteres hexadecimales.
  return randomBytes(32).toString('hex');
}

/*
 * Compara el token enviado con el de la sesion sin revelar cual fallo.
 * Devuelve un estado para que cada ruta decida el mensaje adecuado.
 */
export function estadoTokenCsrf(solicitud) {
  const tokenEnviado = solicitud.body?._csrf;
  const tokenDeSesion = solicitud.session?.csrfToken;

  if (typeof tokenEnviado !== 'string' || typeof tokenDeSesion !== 'string') {
    return 'faltante';
  }

  // timingSafeEqual requiere buffers de igual longitud; la longitud se revisa primero.
  const tokenEnviadoBuffer = Buffer.from(tokenEnviado);
  const tokenDeSesionBuffer = Buffer.from(tokenDeSesion);
  const tienenIgualLongitud = tokenEnviadoBuffer.length === tokenDeSesionBuffer.length;
  const sonIguales = tienenIgualLongitud
    && timingSafeEqual(tokenEnviadoBuffer, tokenDeSesionBuffer);
  return sonIguales ? 'valido' : 'invalido';
}

export function protegerCsrf(solicitud, respuesta, siguiente) {
  const estado = estadoTokenCsrf(solicitud);

  if (estado === 'faltante') {
    return respuesta.status(403).render('error', { mensaje: 'La solicitud vencio. Recarga la pagina.' });
  }
  if (estado === 'invalido') {
    return respuesta.status(403).render('error', { mensaje: 'La solicitud no es valida.' });
  }

  return siguiente();
}

/* Identidad: la sesion identifica al usuario, pero la base confirma que siga activo. */
export function crearCargarUsuarioActual(consulta) {
  return async function cargarUsuarioActual(solicitud, respuesta, siguiente) {
    if (!solicitud.session.userId) return siguiente();

    try {
      // La sesion identifica la cuenta, pero PostgreSQL confirma que siga activa.
      const cuentasActivas = await consulta(
        'SELECT id, nombre, usuario, rol, foto_data IS NOT NULL AS tiene_foto FROM usuarios WHERE id = $1 AND activo = TRUE LIMIT 1',
        [solicitud.session.userId],
      );

      if (cuentasActivas.length === 0) {
        // La cuenta pudo desactivarse despues de iniciar sesion; se invalida su cookie aqui.
        return solicitud.session.destroy(() => {
          respuesta.clearCookie('asistencia.sid');
          respuesta.redirect('/login');
        });
      }

      solicitud.user = cuentasActivas[0];
      return siguiente();
    } catch (error) {
      return siguiente(error);
    }
  };
}

/* Acceso a rutas: primero se exige sesion y despues se comprueba el rol requerido. */
export function requerirLogin(solicitud, respuesta, siguiente) {
  if (!solicitud.user) return respuesta.redirect('/login');
  return siguiente();
}

export function requerirAdmin(solicitud, respuesta, siguiente) {
  if (!solicitud.user) return respuesta.redirect('/login');
  if (solicitud.user.rol !== 'admin') {
    return respuesta.status(403).render('error', { mensaje: 'No tienes permiso para realizar esa accion.' });
  }
  return siguiente();
}

export function validarId(valor) {
  if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor)) return null;
  const id = Number(valor);
  return Number.isSafeInteger(id) ? id : null;
}
