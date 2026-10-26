# Instalacion local (Node.js + PostgreSQL Neon)

Node.js ejecuta la aplicacion web. PostgreSQL en Neon almacena las cuentas, asistencia, alertas y
sesiones. No se requieren XAMPP, Apache ni PHP.

## Requisitos

- Windows 10/11.
- Node.js 22 LTS o superior y npm.
- Una instancia PostgreSQL en Neon con permisos para crear tablas e indices.

## 1. Configurar secretos

El archivo `src/config.js` centraliza entorno, host, puerto, URI PostgreSQL y secreto de sesion.
Los valores se leen desde `.env`; no se escriben credenciales dentro del codigo.

Si aun no existe `.env`:

```powershell
Copy-Item .env.example .env
```

Edita localmente:

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=3000
SESSION_SECRET=un-secreto-aleatorio-de-32-caracteres-o-mas
DATABASE_URL=postgresql://USUARIO:CLAVE@HOST/BASE?sslmode=require&channel_binding=require
```

Usa la URI de Neon asignada a tu proyecto. La aplicacion eleva `sslmode=require` a
`verify-full` para comprobar el certificado TLS. `.env` esta ignorado por Git; nunca pegues la
URI en README, capturas, logs o tickets. Si una URI se compartio accidentalmente, rota su clave
en Neon y actualiza el archivo local.

## 2. Instalar y arrancar

Desde PowerShell, en la carpeta del proyecto:

```powershell
npm ci
npm run db:setup
npm run check
npm test
npm start
```

Abre <http://localhost:3000>. El bind predeterminado es `127.0.0.1`. Para una prueba temporal
en una red privada, configura `HOST=0.0.0.0`, limita el firewall a esa red y usa HTTPS antes de
cualquier acceso con cuentas reales.

En Windows tambien puedes ejecutar `iniciar.bat`: abre Node en una ventana de consola, espera
la respuesta de `/health` y abre el navegador cuando el servidor esta listo. El archivo no
contiene la URI ni otras credenciales. Primero ejecuta `npm ci` para instalar dependencias.

En VS Code tambien puedes iniciar el perfil **Asistencia Escolar (Node.js)** con F5. Ese perfil
lee `.env` localmente; no copies `DATABASE_URL` a `launch.json`.

## 3. Instalador PostgreSQL

`npm run db:setup` usa la misma `DATABASE_URL` que la aplicacion. Si las seis tablas base ya
existen, conserva datos y aplica migraciones pendientes. Una base vacia recibe las tablas
academicas, la demo ficticia y la tabla `sesiones`. Si el esquema base esta incompleto, se detiene
y pide revision manual.

La unica opcion destructiva requiere respaldo y confirmacion explicita:

```powershell
npm run db:setup -- --forzar --confirmar
```

No ejecutes ese comando sobre datos reales: elimina y recrea las tablas del sistema.

## 4. Datos demo

El escenario conserva 3 cursos, 4 secciones, 20 estudiantes, 50 asistencias y 4 alertas. Las
fechas usan `CURRENT_DATE` de PostgreSQL. Las cuentas demo `admin / 12345678`,
`profesor1 / profe123` y `profesor2 / profe123` son publicas y solo para pruebas ficticias;
cambialas antes de cualquier uso real.

## 5. Copias de seguridad y privacidad

Configura backups en Neon y limita el acceso al proyecto. Usa datos ficticios en desarrollo y
capturas; no cargues datos reales de menores sin consentimiento y autorizacion del plantel.
Valida primero el acceso por seccion con cada rol y documenta incidencias sin publicar datos.

## Solucion de problemas

| Problema | Comprobacion |
|---|---|
| `DATABASE_URL` falta o no es PostgreSQL | Revisa `.env`; debe comenzar por `postgresql://` o `postgres://`. |
| Error de certificado TLS | Conserva `sslmode=require` en la URI y no desactives la validacion de certificado. |
| No existe tabla `sesiones` | Ejecuta `npm run db:setup` con el mismo `DATABASE_URL`. |
| Instalacion detenida por esquema parcial | Revisa tablas y respaldos antes de una reinstalacion destructiva. |
| Credenciales demo no funcionan | Confirma que el instalador reporto 3 usuarios; en login los errores son genericos. |
| Error interno de servidor | Revisa el codigo del error en la consola Node; no compartas URI, contrasenas ni SQL privado. |
