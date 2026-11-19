import rutasSistema from 'node:path';
import { fileURLToPath as convertirUrlArchivoARuta } from 'node:url';
import cifrador from 'bcryptjs';
import servidorExpress from 'express';
import sesionesHttp from 'express-session';
import { rateLimit as limitarSolicitudes } from 'express-rate-limit';
import blindarCabeceras from 'helmet';
import { grupoConexiones, consulta } from './db.js';
import { configuracion } from './config.js';
import { esErrorTransitorio } from './errores.js';
import { PostgresSessionStore } from './session-store.js';
import seguimiento from './routes/seguimiento.js';
import administracion from './routes/administracion.js';
import {
  crearCargarUsuarioActual,
  crearTokenCsrf,
  estadoTokenCsrf,
  protegerCsrf,
  requerirLogin,
} from './security.js';

const archivoActual = convertirUrlArchivoARuta(import.meta.url);
const carpetaActual = rutasSistema.dirname(archivoActual);
const carpetaProyecto = rutasSistema.resolve(carpetaActual, '..');
const servidorWeb = servidorExpress();
const almacenSesiones = new PostgresSessionStore(grupoConexiones);

/* Vistas y cabeceras de seguridad */
servidorWeb.set('view engine', 'ejs');
servidorWeb.set('views', rutasSistema.join(carpetaProyecto, 'views'));
servidorWeb.disable('x-powered-by');

// 1. Preparar protecciones HTTP y archivos estaticos.
// Render entrega el trafico mediante un proxy HTTPS: confiar en un salto
// permite cookies Secure y que el rate limit lea la IP real del cliente.
if (configuracion.confiarEnProxy) servidorWeb.set('trust proxy', 1);
servidorWeb.use(blindarCabeceras({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
}));

servidorWeb.get('/.well-known/assetlinks.json', (solicitud, respuesta) => {
  const aplicacion = configuracion.enlacesAndroidPorServidor[solicitud.hostname.toLowerCase()];
  if (!aplicacion) return respuesta.sendStatus(404);

  respuesta.set('Cache-Control', 'public, max-age=3600');
  return respuesta.json([{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: aplicacion.packageName,
      sha256_cert_fingerprints: [aplicacion.sha256CertFingerprint],
    },
  }]);
});

servidorWeb.use(servidorExpress.urlencoded({ extended: true, limit: '50kb', parameterLimit: 1000 }));
servidorWeb.use(servidorExpress.json({ limit: '260kb', type: 'application/json' }));
servidorWeb.use(servidorExpress.static(rutasSistema.join(carpetaProyecto, 'assets'), {
  index: false,
  dotfiles: 'deny',
  // CSS y JavaScript pequenos se reutilizan; una cache corta acelera la navegacion.
  maxAge: '5m',
}));
// El store PostgreSQL se configura antes de las rutas para que cada solicitud tenga sesion persistida.
servidorWeb.use(sesionesHttp({
  name: 'asistencia.sid',
  secret: configuracion.secretoSesion,
  store: almacenSesiones,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: configuracion.cookieSegura,
    maxAge: 8 * 60 * 60 * 1000,
  },
}));

// 2. Preparar datos comunes que usan las vistas y cargar la cuenta de la sesion.
servidorWeb.use((solicitud, respuesta, siguiente) => {
  // Las vistas reciben un token para incluirlo en todos los formularios que modifican datos.
  if (!solicitud.session.csrfToken) solicitud.session.csrfToken = crearTokenCsrf();
  respuesta.locals.csrfToken = solicitud.session.csrfToken;
  respuesta.locals.usuario = null;
  respuesta.locals.flash = solicitud.session.flash || null;
  delete solicitud.session.flash;
  // Una pagina vieja en cache puede traer un token CSRF que ya no corresponde.
  respuesta.set('Cache-Control', 'no-store');
  siguiente();
});
servidorWeb.use(crearCargarUsuarioActual(consulta));
servidorWeb.use((solicitud, respuesta, siguiente) => {
  respuesta.locals.usuario = solicitud.user || null;
  respuesta.locals.rutaActual = solicitud.path;
  siguiente();
});

const limiteLogin = limitarSolicitudes({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: (solicitud) => solicitud.method !== 'POST',
  message: 'Demasiados intentos. Intenta de nuevo mas tarde.',
});

/* Inicio de sesion: leer campos, validar la cuenta y guardar una sesion nueva. */
function obtenerCredenciales(solicitud) {
  const usuario = typeof solicitud.body.usuario === 'string' ? solicitud.body.usuario.trim() : '';
  const clave = typeof solicitud.body.clave === 'string' ? solicitud.body.clave : '';
  return { usuario, clave };
}

async function regenerarSesion(solicitud) {
  await new Promise((resolver, rechazar) => {
    solicitud.session.regenerate((error) => {
      if (error) rechazar(error);
      else resolver();
    });
  });
}

async function guardarSesion(solicitud) {
  await new Promise((resolver, rechazar) => {
    solicitud.session.save((error) => {
      if (error) rechazar(error);
      else resolver();
    });
  });
}

// 3. Inicio y cierre de sesion.
servidorWeb.get('/login', (solicitud, respuesta) => {
  if (solicitud.user) return respuesta.redirect('/');
  return respuesta.render('login', { error: null });
});

// Un doble toque en "Entrar" puede reutilizar una sesion recien regenerada.
// En ese caso se vuelve al formulario con un token nuevo, no a una pagina de error.
function validarCsrfLogin(solicitud, respuesta, siguiente) {
  if (estadoTokenCsrf(solicitud) === 'valido') return siguiente();
  solicitud.session.flash = 'La sesion se renovo. Intenta iniciar sesion de nuevo.';
  return respuesta.redirect('/login');
}

servidorWeb.post('/login', limiteLogin, validarCsrfLogin, async (solicitud, respuesta, siguiente) => {
  const { usuario, clave } = obtenerCredenciales(solicitud);

  if (!usuario || !clave || usuario.length > 50 || clave.length > 200) {
    return respuesta.status(400).render('login', { error: 'Usuario o contrasena incorrectos.' });
  }

  try {
    const cuentas = await consulta(
      'SELECT id, nombre, usuario, rol, password_hash FROM usuarios WHERE usuario = $1 AND activo = TRUE LIMIT 1',
      [usuario],
    );
    const cuenta = cuentas[0];
    // La misma respuesta evita revelar si fallo el usuario o la contrasena.
    const contrasenaValida = cuenta ? await cifrador.compare(clave, cuenta.password_hash) : false;

    if (!contrasenaValida) {
      return respuesta.status(401).render('login', { error: 'Usuario o contrasena incorrectos.' });
    }

    // Crear otra sesion despues de autenticar evita reutilizar un identificador anterior.
    await regenerarSesion(solicitud);
    solicitud.session.userId = cuenta.id;
    solicitud.session.csrfToken = crearTokenCsrf();
    await guardarSesion(solicitud);
    return respuesta.redirect('/');
  } catch (error) {
    return siguiente(error);
  }
});

servidorWeb.post('/logout', protegerCsrf, (solicitud, respuesta, siguiente) => {
  solicitud.session.destroy((error) => {
    if (error) return siguiente(error);
    respuesta.clearCookie('asistencia.sid');
    return respuesta.redirect('/login');
  });
});

/* Panel: los conteos de docente se limitan a las secciones asignadas. */
async function obtenerResumenAdministrador() {
  const filas = await consulta(
    `SELECT
      (SELECT COUNT(*) FROM cursos) AS cursos,
      (SELECT COUNT(*) FROM secciones) AS secciones,
      (SELECT COUNT(*) FROM usuarios WHERE rol = 'docente' AND activo = TRUE) AS docentes,
      (SELECT COUNT(*) FROM estudiantes WHERE activo = TRUE) AS estudiantes,
      (SELECT COUNT(*) FROM alertas WHERE estado = 'pendiente') AS alertas`,
  );
  return filas[0];
}

async function obtenerResumenDocente(idDocente) {
  const filas = await consulta(
    `SELECT COUNT(DISTINCT s.id) AS secciones,
      COUNT(DISTINCT e.id) AS estudiantes,
      COUNT(DISTINCT a.id) AS alertas
     FROM secciones s
     LEFT JOIN estudiantes e ON e.seccion_id = s.id AND e.activo = TRUE
     LEFT JOIN alertas a ON a.estudiante_id = e.id AND a.estado = 'pendiente'
     WHERE EXISTS (
       SELECT 1 FROM seccion_docentes sd
       WHERE sd.seccion_id = s.id AND sd.docente_id = $1
     )`,
    [idDocente],
  );
  return filas[0];
}

// 4. Pagina principal: el resumen depende del rol confirmado en PostgreSQL.
servidorWeb.get('/', requerirLogin, async (solicitud, respuesta, siguiente) => {
  try {
    // Cada rol recibe conteos construidos sobre sus propios permisos.
    const resumen = solicitud.user.rol === 'admin'
      ? await obtenerResumenAdministrador()
      : await obtenerResumenDocente(solicitud.user.id);

    return respuesta.render('dashboard', { resumen });
  } catch (error) {
    return siguiente(error);
  }
});

servidorWeb.use('/', seguimiento);
servidorWeb.use('/gestion', administracion);

/* Salud del servicio y respuestas de error sin exponer SQL ni datos personales. */
servidorWeb.get('/health', async (solicitud, respuesta, siguiente) => {
  try {
    await consulta('SELECT 1');
    return respuesta.json({ estado: 'ok' });
  } catch (error) {
    return siguiente(error);
  }
});

servidorWeb.use((solicitud, respuesta) => respuesta.status(404).render('error', { mensaje: 'La pagina solicitada no existe.' }));
servidorWeb.use((error, solicitud, respuesta, siguiente) => {
  // Registrar contexto tecnico sin incluir URL con IDs, datos personales ni detalles SQL.
  console.error('[asistencia] Error interno:', JSON.stringify({
    fecha: new Date().toISOString(),
    metodo: solicitud.method,
    ruta: solicitud.route?.path || 'sin-ruta',
    codigo: error.code || error.name || 'desconocido',
  }));
  if (respuesta.headersSent) return siguiente(error);

  // Un corte de red o una consulta cancelada se informa como reintento, no como fallo definitivo.
  if (esErrorTransitorio(error) || error.code === '57014') {
    respuesta.set('Retry-After', '5');
    return respuesta.status(503).render('error', { mensaje: 'La conexion tardo demasiado. Intenta nuevamente.' });
  }
  return respuesta.status(500).render('error', { mensaje: 'Ocurrio un error. Intenta nuevamente.' });
});

const servidor = servidorWeb.listen(configuracion.puerto, configuracion.anfitrion, () => {
  console.log(
    `Asistencia Escolar Inteligente disponible en http://${configuracion.anfitrion}:${configuracion.puerto}`
    + ` | entorno=${configuracion.entornoNode} | proxy=${configuracion.confiarEnProxy}`,
  );
});

// Cerrar conexiones al detener el proceso para evitar sesiones a medio guardar.
async function cerrarServidor() {
  servidor.close();
  almacenSesiones.close();
  await grupoConexiones.end();
}

process.on('SIGINT', cerrarServidor);
process.on('SIGTERM', cerrarServidor);
