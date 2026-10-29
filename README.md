# Asistencia Escolar Inteligente

Sistema web para registrar asistencia escolar y detectar temprano el riesgo de inasistencia
recurrente. Debe resolver un problema real, poder explicarse ante un jurado y validarse con
docentes y estudiantes en menos de siete dias.

## Funciones

- Registrar presente, tardanza, ausencia y falta justificada.
- Generar alertas explicables a partir de ausencias y rachas consecutivas.
- Filtrar reportes por curso, seccion y fechas; tardanza cuenta como asistencia.
- Administrar cursos, secciones, estudiantes, docentes y administradores desde la cuenta coordinadora.
- Asignar varios docentes a una seccion y restringir cada cuenta a sus secciones y estudiantes.

## Regla de alerta

- `justificado` no suma como falta de riesgo.
- 3 ausencias no justificadas en 30 dias generan nivel medio.
- 5 ausencias o una racha de 3 dias generan nivel alto.
- 4 o mas tardanzas en 30 dias agregan un punto al puntaje.
- Cada alerta conserva los conteos que explican la decision.

La regla pura esta en [src/alertas.js](src/alertas.js). Las consultas de seguimiento estan en
[src/routes/seguimiento.js](src/routes/seguimiento.js).

## Stack

- Node.js 22 LTS o superior, Express 5 y vistas EJS.
- PostgreSQL en Neon, con `pg` y consultas parametrizadas.
- Configuracion general en `src/config.js`; secretos exclusivamente en `.env`.
- Bootstrap 5 y CSS del proyecto.
- Aplicacion Android con Capacitor que abre el sistema web desplegado.

Node escucha siempre en `0.0.0.0:$PORT` (por defecto `3000`) para que el proxy de Render pueda
alcanzarla; la variable `HOST` se ignora a proposito. El runtime PHP anterior se retiro del
proyecto; solo queda Node.js como servidor y `.htaccess` como bloqueo de respaldo.

## Configuracion e instalacion

1. Instala Node.js 22 o superior.
2. Copia `.env.example` a `.env` si aun no existe y define `DATABASE_URL` con la URI PostgreSQL
   de Neon y `SESSION_SECRET` con al menos 32 caracteres aleatorios. El `.env` local ya contiene
   la configuracion proporcionada para esta instancia; no la publiques.
3. Instala y valida:

   ```powershell
   npm ci
   npm run db:setup
   npm run check
   npm test
   npm start
   ```

4. Abre <http://localhost:3000>.

El instalador crea esquema, demo y sesiones solo si la base esta vacia. Conserva esquemas y datos
existentes; si detecta un esquema parcial se detiene. La operacion destructiva requiere respaldo
y doble confirmacion: `npm run db:setup -- --forzar --confirmar`.

**Seguridad de credenciales:** la URI fue compartida en una conversacion. Rota su contrasena en
Neon antes de usar la base con datos reales y actualiza solo el `.env` local.

## Despliegue en Render

El repositorio incluye `render.yaml`, asi que basta con crear un Blueprint en Render y conectar
GitHub. Si se configura manualmente, usar:

| Campo | Valor |
|---|---|
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Health Check Path | `/health` |

Variables de entorno obligatorias (no se guardan en Git):

- `DATABASE_URL`: URI de Neon con `sslmode=require`.
- `SESSION_SECRET`: al menos 32 caracteres aleatorios.
- `NODE_ENV=production` (ya viene en `render.yaml`; Render tambien se detecta por `RENDER=true`).
- No configures `HOST`: se ignora para evitar que un `127.0.0.1` deje el servicio inaccesible.

La base ya inicializada se comparte con Neon, por lo que no hace falta ejecutar `npm run db:setup`
en cada despliegue. Si la base estuviera vacia, ejecutarlo una sola vez desde la Shell del
servicio en Render. `NODE_ENV=production` activa cookies `Secure`, por lo que el sitio debe abrirse
por HTTPS (Render lo entrega automaticamente).

## Aplicacion Android

La app Capacitor reutiliza el sitio Express publicado por Render; requiere internet y no funciona
como copia local sin conexion. Configura `CAPACITOR_SERVER_URL` en `.env` con la URL HTTPS publica
real del servicio antes de generar el APK. El valor de ejemplo en `.env.example` corresponde al
nombre del servicio de `render.yaml`; si Render asigno otro dominio, reemplazalo.

Con Android Studio, Java y el Android SDK instalados, ejecuta:

```powershell
npm ci
npm run mobile:sync
npm run mobile:open
```

En Android Studio, selecciona un emulador o dispositivo y ejecuta la app. El identificador Android
es `com.sistema.asistencia`; no lo cambies despues de distribuir la aplicacion.

## Cero confianza

Cada solicitud protegida revalida que la cuenta siga activa. Los permisos se comprueban en el
servidor para cada seccion, estudiante y alerta; los roles enviados por navegador no son
autoridad. Las mutaciones usan POST y CSRF, SQL usa `$1`, `$2`, etc., las contrasenas usan bcrypt
y las sesiones persistentes se almacenan en PostgreSQL. TLS valida el certificado completo;
Helmet/CSP, rate limit y mensajes genericos reducen exposicion. El desarrollo usa datos
ficticios; no introduzcas datos reales de menores sin autorizacion y validacion del plantel.

## Pruebas

- `npm test`: reglas de alertas, seguridad, store de sesiones, parser SQL y compilacion EJS.
- `npm run check`: sintaxis de los modulos JavaScript.
- GitHub Actions instala Node 22, ejecuta `npm ci`, `npm run check` y `npm test`.
- La prueba real de PostgreSQL se hizo con el instalador: 3 cursos, 4 secciones, 20 estudiantes,
  50 asistencias y 4 alertas pendientes.
- Aun faltan pruebas de autorizacion por objeto y validacion con usuarios del plantel.

## Equipo de tres

- Analisis y diseno: requisitos, entrevistas, diagramas y flujo de pantallas.
- Programacion y datos: consultas, reglas, permisos y seguridad.
- Interfaz y pruebas: usabilidad, escenarios, errores y mejoras.
- Los tres hacen revision cruzada y pueden explicar todas las partes.

Registrar la validacion con docentes y estudiantes en menos de siete dias: perfil, tarea,
resultado y mejora, sin capturar datos personales innecesarios.

## Documentacion

- [Instalacion local](docs/instalacion-local.md)
- [Modelo de datos](docs/base-de-datos.md)
- [Manual de usuario](docs/manual-usuario.md)
- [Guia de pruebas](docs/guia-pruebas.md)
- [Guia de defensa](docs/guia-defensa.md)
- [Memoria del equipo](memoria/MEMORY.md)
