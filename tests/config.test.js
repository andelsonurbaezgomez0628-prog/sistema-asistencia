import test from 'node:test';
import assert from 'node:assert/strict';

const base = {
  DATABASE_URL: 'postgresql://usuario:clave@localhost/base?sslmode=require&channel_binding=require',
  SESSION_SECRET: 'secreto-local-de-prueba-con-mas-de-32-caracteres',
};

// GitHub Actions no tiene .env: se define un entorno valido antes de importar
// el modulo, que crea la configuracion global al cargarse.
process.env.DATABASE_URL = base.DATABASE_URL;
process.env.SESSION_SECRET = base.SESSION_SECRET;
const { crearConfiguracion } = await import('../src/config.js');

test('centraliza valores y exige verificacion TLS completa', () => {
  const configuracion = crearConfiguracion({ ...base, NODE_ENV: 'production', PORT: '4444' });
  const uri = new URL(configuracion.databaseUrl);
  assert.equal(uri.searchParams.get('sslmode'), 'verify-full');
  assert.equal(uri.searchParams.get('channel_binding'), 'require');
  assert.equal(configuracion.port, 4444);
  assert.equal(configuracion.cookieSecure, true);
  assert.equal(configuracion.trustProxy, true);
  assert.equal(configuracion.host, '0.0.0.0');
});

test('detecta Render aunque NODE_ENV no este definido', () => {
  const configuracion = crearConfiguracion({ ...base, RENDER: 'true' });
  assert.equal(configuracion.trustProxy, true);
  assert.equal(configuracion.cookieSecure, true);
  assert.equal(configuracion.host, '0.0.0.0');
});

test('en desarrollo local no confia en el proxy', () => {
  const configuracion = crearConfiguracion(base);
  assert.equal(configuracion.trustProxy, false);
  assert.equal(configuracion.cookieSecure, false);
});

test('rechaza una URI que no sea PostgreSQL', () => {
  assert.throws(
    () => crearConfiguracion({ ...base, DATABASE_URL: 'mysql://localhost/base' }),
    /URI PostgreSQL/,
  );
});

test('rechaza secreto de sesion corto', () => {
  assert.throws(
    () => crearConfiguracion({ ...base, SESSION_SECRET: 'corto' }),
    /32 caracteres/,
  );
});

test('rechaza un puerto fuera de rango', () => {
  assert.throws(() => crearConfiguracion({ ...base, PORT: '70000' }), /PORT/);
});

test('requiere URI de base y secreto', () => {
  assert.throws(() => crearConfiguracion({}), /DATABASE_URL/);
});