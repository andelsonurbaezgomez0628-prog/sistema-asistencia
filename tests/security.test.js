import prueba from 'node:test';
import afirmar from 'node:assert/strict';
import {
  crearCargarUsuarioActual,
  crearTokenCsrf,
  estadoTokenCsrf,
  protegerCsrf,
  requerirAdmin,
  requerirLogin,
  validarId,
} from '../src/security.js';

function crearRespuesta() {
  return {
    statusCode: null,
    vista: null,
    datos: null,
    ruta: null,
    cookieEliminada: null,
    status(codigo) { this.statusCode = codigo; return this; },
    render(vista, datos) { this.vista = vista; this.datos = datos; return this; },
    redirect(ruta) { this.ruta = ruta; return this; },
    clearCookie(nombre) { this.cookieEliminada = nombre; return this; },
  };
}

prueba('genera token CSRF aleatorio de 256 bits', () => {
  const token = crearTokenCsrf();
  afirmar.match(token, /^[a-f0-9]{64}$/);
  afirmar.notEqual(token, crearTokenCsrf());
});

prueba('acepta token CSRF valido', () => {
  let siguiente = false;
  protegerCsrf(
    { body: { _csrf: 'token-valido' }, session: { csrfToken: 'token-valido' } },
    crearRespuesta(),
    () => { siguiente = true; },
  );
  afirmar.equal(siguiente, true);
});

prueba('rechaza token CSRF faltante o alterado', () => {
  for (const body of [{}, { _csrf: 'otro-token' }]) {
    const respuesta = crearRespuesta();
    protegerCsrf({ body, session: { csrfToken: 'token-valido' } }, respuesta, () => afirmar.fail('No debe continuar'));
    afirmar.equal(respuesta.statusCode, 403);
    afirmar.equal(respuesta.vista, 'error');
  }
});

prueba('distingue token CSRF faltante, invalido y valido sin revelar detalles', () => {
  afirmar.equal(estadoTokenCsrf({ body: {}, session: {} }), 'faltante');
  afirmar.equal(
    estadoTokenCsrf({ body: { _csrf: 'otro-token' }, session: { csrfToken: 'token-valido' } }),
    'invalido',
  );
  afirmar.equal(
    estadoTokenCsrf({ body: { _csrf: 'token-valido' }, session: { csrfToken: 'token-valido' } }),
    'valido',
  );
});

prueba('requiere una sesion y bloquea roles que no son admin', () => {
  const respuestaSinSesion = crearRespuesta();
  requerirLogin({ user: null }, respuestaSinSesion, () => afirmar.fail('No debe continuar'));
  afirmar.equal(respuestaSinSesion.ruta, '/login');

  const respuestaDocente = crearRespuesta();
  requerirAdmin({ user: { rol: 'docente' } }, respuestaDocente, () => afirmar.fail('No debe continuar'));
  afirmar.equal(respuestaDocente.statusCode, 403);

  let siguiente = false;
  requerirAdmin({ user: { rol: 'admin' } }, crearRespuesta(), () => { siguiente = true; });
  afirmar.equal(siguiente, true);
});

prueba('solo acepta IDs enteros positivos canonicos y seguros', () => {
  afirmar.equal(validarId('42'), 42);
  for (const valor of ['', '0', '01', '-3', '1.5', '1e3', '9007199254740992']) {
    afirmar.equal(validarId(valor), null);
  }
});

prueba('consulta la cuenta activa en cada solicitud autenticada', async () => {
  let consultas = 0;
  const cargar = crearCargarUsuarioActual(async (sql, valores) => {
    consultas += 1;
    afirmar.match(sql, /activo = TRUE/);
    afirmar.deepEqual(valores, [8]);
    return [{ id: 8, nombre: 'Docente', rol: 'docente' }];
  });
  const solicitud = { session: { userId: 8 } };
  let siguiente = false;
  await cargar(solicitud, crearRespuesta(), (error) => { afirmar.ifError(error); siguiente = true; });
  afirmar.equal(consultas, 1);
  afirmar.equal(solicitud.user.id, 8);
  afirmar.equal(siguiente, true);
});

prueba('invalida la sesion si la cuenta fue desactivada', async () => {
  const cargar = crearCargarUsuarioActual(async () => []);
  let sesionDestruida = false;
  const solicitud = { session: { userId: 8, destroy(funcionFinalizacion) { sesionDestruida = true; funcionFinalizacion(); } } };
  const respuesta = crearRespuesta();
  await cargar(solicitud, respuesta, () => afirmar.fail('No debe continuar'));
  afirmar.equal(sesionDestruida, true);
  afirmar.equal(respuesta.cookieEliminada, 'asistencia.sid');
  afirmar.equal(respuesta.ruta, '/login');
});

prueba('continua sin consulta cuando no hay identidad en la sesion', async () => {
  const cargar = crearCargarUsuarioActual(async () => afirmar.fail('No debe consultar'));
  let siguiente = false;
  await cargar({ session: {} }, crearRespuesta(), () => { siguiente = true; });
  afirmar.equal(siguiente, true);
});