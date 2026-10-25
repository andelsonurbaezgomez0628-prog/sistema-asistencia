import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import express from 'express';
import session from 'express-session';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { pool, consulta } from './db.js';
import { config } from './config.js';
import { PostgresSessionStore } from './session-store.js';
import seguimiento from './routes/seguimiento.js';
import administracion from './routes/administracion.js';
import {
  crearCargarUsuarioActual,
  crearTokenCsrf,
  protegerCsrf,
  requerirLogin,
} from './security.js';

const archivoActual = fileURLToPath(import.meta.url);
const carpetaActual = path.dirname(archivoActual);
const carpetaProyecto = path.resolve(carpetaActual, '..');
const app = express();
const sessionStore = new PostgresSessionStore(pool);

app.set('view engine', 'ejs');
app.set('views', path.join(carpetaProyecto, 'views'));
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", 'https://cdn.jsdelivr.net'],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
}));
app.use(express.urlencoded({ extended: true, limit: '50kb', parameterLimit: 1000 }));
app.use(express.static(path.join(carpetaProyecto, 'assets'), { index: false, dotfiles: 'deny' }));
app.use(session({
  name: 'asistencia.sid',
  secret: config.sessionSecret,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: 8 * 60 * 60 * 1000,
  },
}));
app.use((req, res, next) => {
  if (!req.session.csrfToken) req.session.csrfToken = crearTokenCsrf();
  res.locals.csrfToken = req.session.csrfToken;
  res.locals.usuario = null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});
app.use(crearCargarUsuarioActual(consulta));
app.use((req, res, next) => {
  res.locals.usuario = req.user || null;
  res.locals.rutaActual = req.path;
  next();
});

const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: (req) => req.method !== 'POST',
  message: 'Demasiados intentos. Intenta de nuevo mas tarde.',
});

app.get('/login', (req, res) => {
  if (req.user) return res.redirect('/');
  return res.render('login', { error: null });
});

app.post('/login', limiteLogin, protegerCsrf, async (req, res, next) => {
  const usuario = typeof req.body.usuario === 'string' ? req.body.usuario.trim() : '';
  const clave = typeof req.body.clave === 'string' ? req.body.clave : '';

  if (!usuario || !clave || usuario.length > 50 || clave.length > 200) {
    return res.status(400).render('login', { error: 'Usuario o contrasena incorrectos.' });
  }

  try {
    const filas = await consulta(
      'SELECT id, nombre, usuario, rol, password_hash FROM usuarios WHERE usuario = $1 AND activo = TRUE LIMIT 1',
      [usuario],
    );
    const cuenta = filas[0];
    const valida = cuenta ? await bcrypt.compare(clave, cuenta.password_hash) : false;

    if (!valida) return res.status(401).render('login', { error: 'Usuario o contrasena incorrectos.' });

    await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
    req.session.userId = cuenta.id;
    req.session.csrfToken = crearTokenCsrf();
    return req.session.save((error) => error ? next(error) : res.redirect('/'));
  } catch (error) {
    return next(error);
  }
});

app.post('/logout', protegerCsrf, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('asistencia.sid');
    return res.redirect('/login');
  });
});

app.get('/', requerirLogin, async (req, res, next) => {
  try {
    let resumen;
    if (req.user.rol === 'admin') {
      const filas = await consulta(
        `SELECT
          (SELECT COUNT(*) FROM cursos) AS cursos,
          (SELECT COUNT(*) FROM secciones) AS secciones,
          (SELECT COUNT(*) FROM usuarios WHERE rol = 'docente' AND activo = TRUE) AS docentes,
          (SELECT COUNT(*) FROM estudiantes WHERE activo = TRUE) AS estudiantes,
          (SELECT COUNT(*) FROM alertas WHERE estado = 'pendiente') AS alertas`,
      );
      resumen = filas[0];
    } else {
      const filas = await consulta(
        `SELECT COUNT(DISTINCT s.id) AS secciones,
          COUNT(DISTINCT e.id) AS estudiantes,
          COUNT(DISTINCT a.id) AS alertas
         FROM secciones s
         LEFT JOIN estudiantes e ON e.seccion_id = s.id AND e.activo = TRUE
         LEFT JOIN alertas a ON a.estudiante_id = e.id AND a.estado = 'pendiente'
         WHERE s.docente_id = $1`,
        [req.user.id],
      );
      resumen = filas[0];
    }

    return res.render('dashboard', { resumen });
  } catch (error) {
    return next(error);
  }
});

app.use('/', seguimiento);
app.use('/gestion', administracion);

app.get('/health', async (req, res, next) => {
  try {
    await consulta('SELECT 1');
    return res.json({ estado: 'ok' });
  } catch (error) {
    return next(error);
  }
});

app.use((req, res) => res.status(404).render('error', { mensaje: 'La pagina solicitada no existe.' }));
app.use((error, req, res, next) => {
  console.error('[asistencia] Error interno:', error.code || error.name || 'desconocido');
  if (res.headersSent) return next(error);
  return res.status(500).render('error', { mensaje: 'Ocurrio un error. Intenta nuevamente.' });
});

const servidor = app.listen(config.port, config.host, () => {
  console.log(`Asistencia Escolar Inteligente disponible en http://${config.host}:${config.port}`);
});

async function cerrarServidor() {
  servidor.close();
  sessionStore.close();
  await pool.end();
}

process.on('SIGINT', cerrarServidor);
process.on('SIGTERM', cerrarServidor);