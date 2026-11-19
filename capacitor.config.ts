import type { CapacitorConfig as ConfiguracionCapacitor } from '@capacitor/cli';
import 'dotenv/config';
import process as proceso from 'node:process';

const urlServidor = proceso.env.CAPACITOR_SERVER_URL || 'https://sistema-asistencia-2os4.onrender.com';

const configuracion: ConfiguracionCapacitor = {
  appId: 'com.sistema.asistencia',
  appName: 'Sistema Asistencia',
  webDir: 'www',
  server: {
    url: urlServidor,
    cleartext: false,
  },
};

export default configuracion;
