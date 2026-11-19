import prueba from 'node:test';
import afirmar from 'node:assert/strict';

const valoresBase = {
  DATABASE_URL: 'postgresql://usuario:clave@localhost/base?sslmode=require&channel_binding=require',
  SESSION_SECRET: 'secreto-local-de-prueba-con-mas-de-32-caracteres',
};

// GitHub Actions no tiene .env: se define un entorno valido antes de importar
// el modulo, que crea la configuracion global al cargarse.
process.env.DATABASE_URL = valoresBase.DATABASE_URL;
process.env.SESSION_SECRET = valoresBase.SESSION_SECRET;
const { crearConfiguracion } = await import('../src/config.js');

prueba('centraliza valores y exige verificacion TLS completa', () => {
  const configuracion = crearConfiguracion({ ...valoresBase, NODE_ENV: 'production', PORT: '4444' });
  const direccion = new URL(configuracion.urlBaseDatos);
  afirmar.equal(direccion.searchParams.get('sslmode'), 'verify-full');
  afirmar.equal(direccion.searchParams.get('channel_binding'), 'require');
  afirmar.equal(configuracion.puerto, 4444);
  afirmar.equal(configuracion.cookieSegura, true);
  afirmar.equal(configuracion.confiarEnProxy, true);
  afirmar.equal(configuracion.anfitrion, '0.0.0.0');
});

prueba('detecta Render aunque NODE_ENV no este definido', () => {
  const configuracion = crearConfiguracion({ ...valoresBase, RENDER: 'true' });
  afirmar.equal(configuracion.confiarEnProxy, true);
  afirmar.equal(configuracion.cookieSegura, true);
  afirmar.equal(configuracion.anfitrion, '0.0.0.0');
});

prueba('en desarrollo local no confia en el proxy', () => {
  const configuracion = crearConfiguracion(valoresBase);
  afirmar.equal(configuracion.confiarEnProxy, false);
  afirmar.equal(configuracion.cookieSegura, false);
  afirmar.equal(configuracion.anfitrion, '0.0.0.0');
});

prueba('ignora un HOST de loopback que romperia el despliegue', () => {
  const configuracion = crearConfiguracion({ ...valoresBase, HOST: '127.0.0.1', RENDER: 'true' });
  afirmar.equal(configuracion.anfitrion, '0.0.0.0');
});

prueba('rechaza una URI que no sea PostgreSQL', () => {
  afirmar.throws(
    () => crearConfiguracion({ ...valoresBase, DATABASE_URL: 'mysql://localhost/base' }),
    /URI PostgreSQL/,
  );
});

prueba('rechaza secreto de sesion corto', () => {
  afirmar.throws(
    () => crearConfiguracion({ ...valoresBase, SESSION_SECRET: 'corto' }),
    /32 caracteres/,
  );
});

prueba('rechaza un puerto fuera de rango', () => {
  afirmar.throws(() => crearConfiguracion({ ...valoresBase, PORT: '70000' }), /PORT/);
});

prueba('requiere URI de base y secreto', () => {
  afirmar.throws(() => crearConfiguracion({}), /DATABASE_URL/);
});
