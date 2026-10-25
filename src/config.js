import 'dotenv/config';

function requerido(nombre, variables) {
  const valor = variables[nombre];
  if (!valor) throw new Error(`${nombre} debe configurarse en .env.`);
  return valor;
}

export function crearConfiguracion(variables = process.env) {
  const databaseUrl = new URL(requerido('DATABASE_URL', variables));
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
    throw new Error('DATABASE_URL debe ser una URI PostgreSQL.');
  }
  if (databaseUrl.searchParams.get('sslmode') === 'require') {
    databaseUrl.searchParams.set('sslmode', 'verify-full');
  }

  const sessionSecret = requerido('SESSION_SECRET', variables);
  if (sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET debe tener al menos 32 caracteres.');
  }

  const port = Number(variables.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT debe ser un puerto entero entre 1 y 65535.');
  }

  const nodeEnv = variables.NODE_ENV || 'development';
  // Render define RENDER=true aunque NODE_ENV no se configure. Detectarlo evita
  // que el servicio quede escuchando solo en loopback y sin cookies Secure.
  const enHosting = nodeEnv === 'production' || Boolean(variables.RENDER);
  return Object.freeze({
    nodeEnv,
    // 0.0.0.0 permite que el proxy del hosting alcance la aplicacion.
    host: variables.HOST || '0.0.0.0',
    port,
    databaseUrl: databaseUrl.toString(),
    sessionSecret,
    cookieSecure: enHosting,
    trustProxy: enHosting,
  });
}

export const config = crearConfiguracion();