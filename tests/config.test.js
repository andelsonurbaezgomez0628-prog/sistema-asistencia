import test from 'node:test';
import assert from 'node:assert/strict';

const valoresBase = {
  DATABASE_URL: 'postgresql://usuario:clave@localhost/base?sslmode=require&channel_binding=require',
  SESSION_SECRET: 'secreto-local-de-prueba-con-mas-de-32-caracteres',
};

// GitHub Actions no tiene .env: se define un entorno valido antes de importar
// el modulo, que crea la configuracion global al cargarse.
process.env.DATABASE_URL = valoresBase.DATABASE_URL;
process.env.SESSION_SECRET = valoresBase.SESSION_SECRET;
const { crearConfiguracion } = await import('../src/config.js');

test('centraliza valores y exige verificacion TLS completa', () => {
  const configuracion = crearConfiguracion({ ...valoresBase, NODE_ENV: 'production', PORT: '4444' });
  const direccion = new URL(configuracion.urlBaseDatos);
  assert.equal(direccion.searchParams.get('sslmode'), 'verify-full');
  assert.equal(direccion.searchParams.get('channel_binding'), 'require');
  assert.equal(configuracion.puerto, 4444);
  assert.equal(configuracion.cookieSegura, true);
  assert.equal(configuracion.confiarEnProxy, true);
  assert.equal(configuracion.anfitrion, '0.0.0.0');
});

test('detecta Render aunque NODE_ENV no este definido', () => {
  const configuracion = crearConfiguracion({ ...valoresBase, RENDER: 'true' });
  assert.equal(configuracion.confiarEnProxy, true);
  assert.equal(configuracion.cookieSegura, true);
  assert.equal(configuracion.anfitrion, '0.0.0.0');
});

test('en desarrollo local no confia en el proxy', () => {
  const configuracion = crearConfiguracion(valoresBase);
  assert.equal(configuracion.confiarEnProxy, false);
  assert.equal(configuracion.cookieSegura, false);
  assert.equal(configuracion.anfitrion, '0.0.0.0');
});

test('ignora un HOST de loopback que romperia el despliegue', () => {
  const configuracion = crearConfiguracion({ ...valoresBase, HOST: '127.0.0.1', RENDER: 'true' });
  assert.equal(configuracion.anfitrion, '0.0.0.0');
});

test('rechaza una URI que no sea PostgreSQL', () => {
  assert.throws(
    () => crearConfiguracion({ ...valoresBase, DATABASE_URL: 'mysql://localhost/base' }),
    /URI PostgreSQL/,
  );
});

test('rechaza secreto de sesion corto', () => {
  assert.throws(
    () => crearConfiguracion({ ...valoresBase, SESSION_SECRET: 'corto' }),
    /32 caracteres/,
  );
});

test('rechaza un puerto fuera de rango', () => {
  assert.throws(() => crearConfiguracion({ ...valoresBase, PORT: '70000' }), /PORT/);
});

test('requiere URI de base y secreto', () => {
  assert.throws(() => crearConfiguracion({}), /DATABASE_URL/);
});
