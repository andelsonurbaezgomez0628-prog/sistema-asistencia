import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crearCargarUsuarioActual,
  crearTokenCsrf,
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

test('genera token CSRF aleatorio de 256 bits', () => {
  const token = crearTokenCsrf();
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.notEqual(token, crearTokenCsrf());
});

test('acepta token CSRF valido', () => {
  let siguiente = false;
  protegerCsrf(
    { body: { _csrf: 'token-valido' }, session: { csrfToken: 'token-valido' } },
    crearRespuesta(),
    () => { siguiente = true; },
  );
  assert.equal(siguiente, true);
});

test('rechaza token CSRF faltante o alterado', () => {
  for (const body of [{}, { _csrf: 'otro-token' }]) {
    const respuesta = crearRespuesta();
    protegerCsrf({ body, session: { csrfToken: 'token-valido' } }, respuesta, () => assert.fail('No debe continuar'));
    assert.equal(respuesta.statusCode, 403);
    assert.equal(respuesta.vista, 'error');
  }
});

test('requiere una sesion y bloquea roles que no son admin', () => {
  const respuestaSinSesion = crearRespuesta();
  requerirLogin({ user: null }, respuestaSinSesion, () => assert.fail('No debe continuar'));
  assert.equal(respuestaSinSesion.ruta, '/login');

  const respuestaDocente = crearRespuesta();
  requerirAdmin({ user: { rol: 'docente' } }, respuestaDocente, () => assert.fail('No debe continuar'));
  assert.equal(respuestaDocente.statusCode, 403);

  let siguiente = false;
  requerirAdmin({ user: { rol: 'admin' } }, crearRespuesta(), () => { siguiente = true; });
  assert.equal(siguiente, true);
});

test('solo acepta IDs enteros positivos canonicos y seguros', () => {
  assert.equal(validarId('42'), 42);
  for (const valor of ['', '0', '01', '-3', '1.5', '1e3', '9007199254740992']) {
    assert.equal(validarId(valor), null);
  }
});

test('consulta la cuenta activa en cada solicitud autenticada', async () => {
  let consultas = 0;
  const cargar = crearCargarUsuarioActual(async (sql, valores) => {
    consultas += 1;
    assert.match(sql, /activo = TRUE/);
    assert.deepEqual(valores, [8]);
    return [{ id: 8, nombre: 'Docente', rol: 'docente' }];
  });
  const req = { session: { userId: 8 } };
  let siguiente = false;
  await cargar(req, crearRespuesta(), (error) => { assert.ifError(error); siguiente = true; });
  assert.equal(consultas, 1);
  assert.equal(req.user.id, 8);
  assert.equal(siguiente, true);
});

test('invalida la sesion si la cuenta fue desactivada', async () => {
  const cargar = crearCargarUsuarioActual(async () => []);
  let sesionDestruida = false;
  const req = { session: { userId: 8, destroy(callback) { sesionDestruida = true; callback(); } } };
  const respuesta = crearRespuesta();
  await cargar(req, respuesta, () => assert.fail('No debe continuar'));
  assert.equal(sesionDestruida, true);
  assert.equal(respuesta.cookieEliminada, 'asistencia.sid');
  assert.equal(respuesta.ruta, '/login');
});

test('continua sin consulta cuando no hay identidad en la sesion', async () => {
  const cargar = crearCargarUsuarioActual(async () => assert.fail('No debe consultar'));
  let siguiente = false;
  await cargar({ session: {} }, crearRespuesta(), () => { siguiente = true; });
  assert.equal(siguiente, true);
});