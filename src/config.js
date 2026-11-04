import 'dotenv/config';

// La huella es publica: Digital Asset Links la usa para asociar la web con los APK firmados.
const androidAssetLinksByHost = Object.freeze({
  'sistema-asistencia-2os4.onrender.com': Object.freeze({
    packageName: 'com.sistema.asistencia',
    sha256CertFingerprint: '68:97:04:AA:70:B4:85:87:A8:8D:18:E3:72:27:7C:44:0B:28:C3:CA:6B:67:F0:A3:56:B6:1E:50:C6:AA:79:3B',
  }),
  'sistema-ineligente.hostless.app': Object.freeze({
    packageName: 'com.sistema.asistencia.hostless',
    sha256CertFingerprint: '68:97:04:AA:70:B4:85:87:A8:8D:18:E3:72:27:7C:44:0B:28:C3:CA:6B:67:F0:A3:56:B6:1E:50:C6:AA:79:3B',
  }),
});

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
  // que el servicio quede sin cookies Secure o sin confiar en el proxy.
  const usarAjustesDeHosting = nodeEnv === 'production' || Boolean(variables.RENDER);
  return Object.freeze({
    nodeEnv,
    // Siempre 0.0.0.0: el proxy del hosting necesita alcanzar la aplicacion.
    // No se acepta HOST porque un valor 127.0.0.1 deja el servicio inaccesible.
    host: '0.0.0.0',
    port,
    databaseUrl: databaseUrl.toString(),
    sessionSecret,
    cookieSecure: usarAjustesDeHosting,
    trustProxy: usarAjustesDeHosting,
    androidAssetLinksByHost,
  });
}

export const config = crearConfiguracion();
