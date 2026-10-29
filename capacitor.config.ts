import type { CapacitorConfig } from '@capacitor/cli';
import 'dotenv/config';
import process from 'node:process';

const serverUrl = process.env.CAPACITOR_SERVER_URL || 'https://sistema-asistencia-2os4.onrender.com';

const config: CapacitorConfig = {
  appId: 'com.sistema.asistencia',
  appName: 'Sistema Asistencia',
  webDir: 'www',
  server: {
    url: serverUrl,
    cleartext: false,
  },
};

export default config;
