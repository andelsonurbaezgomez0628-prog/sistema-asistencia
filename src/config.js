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
  // En produccion el hosting (Render) necesita escuchar en todas las interfaces.
  const hostPorDefecto = nodeEnv === 'production' ? '0.0.0.0' : '127.0.0.1';
  return Object.freeze({
    nodeEnv,
    host: variables.HOST || hostPorDefecto,
    port,
    databaseUrl: databaseUrl.toString(),
    sessionSecret,
    cookieSecure: nodeEnv === 'production',
  });
}

export const config = crearConfiguracion();