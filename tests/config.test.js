import test from 'node:test';
import assert from 'node:assert/strict';
import { crearConfiguracion } from '../src/config.js';

const base = {
  DATABASE_URL: 'postgresql://usuario:clave@localhost/base?sslmode=require&channel_binding=require',
  SESSION_SECRET: 'secreto-local-de-prueba-con-mas-de-32-caracteres',
};

test('centraliza valores y exige verificacion TLS completa', () => {
  const configuracion = crearConfiguracion({ ...base, NODE_ENV: 'production', PORT: '4444' });
  const uri = new URL(configuracion.databaseUrl);
  assert.equal(uri.searchParams.get('sslmode'), 'verify-full');
  assert.equal(uri.searchParams.get('channel_binding'), 'require');
  assert.equal(configuracion.port, 4444);
  assert.equal(configuracion.cookieSecure, true);
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