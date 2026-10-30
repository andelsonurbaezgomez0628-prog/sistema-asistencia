# Documentacion completa del proyecto

## 1. Proposito

Asistencia Escolar Inteligente es un sistema web para registrar asistencia escolar, consultar
reportes y detectar patrones de inasistencia. Las alertas guardan los conteos que explican su
nivel para que coordinacion y docentes puedan revisar y atender los casos.

El sistema usa datos minimos para operar. Los datos de demostracion son ficticios; la informacion
real de estudiantes requiere autorizacion del plantel, consentimiento segun sus reglas y controles
de acceso por seccion.

## 2. Capacidades

- Registrar presente, tardanza, ausente o justificado por estudiante, seccion y fecha.
- Actualizar un registro del mismo estudiante y fecha sin crear una fila duplicada.
- Calcular alertas tempranas con una explicacion, nivel y evidencia numerica.
- Revisar y atender alertas; filtrar por nivel y estado.
- Consultar reportes por rango de fechas, curso y seccion.
- Administrar cursos, secciones, estudiantes, docentes y cuentas administradoras.
- Asignar uno o varios docentes a una seccion.
- Restringir los datos de cada docente a las secciones que tiene asignadas.
- Editar los datos propios de la cuenta y cambiar su contrasena.
- Usar una aplicacion Android basada en Capacitor que abre el servicio web publicado.

## 3. Usuarios y permisos

| Rol | Alcance |
|---|---|
| `admin` | Acceso a todos los cursos, secciones, estudiantes, asistencias, alertas y reportes. Administra los registros academicos y puede recalcular todas las alertas. |
| `docente` | Acceso a las secciones asignadas en `seccion_docentes`. Puede registrar asistencia, ver reportes de esas secciones y atender las alertas de sus estudiantes. No puede abrir Gestion ni recalcular globalmente. |

El rol se lee de la cuenta activa en PostgreSQL. Los valores enviados por el navegador nunca otorgan permisos. Cada ruta que usa un objeto vuelve a comprobar que el objeto pertenece al alcance del usuario.

## 4. Reglas de asistencia y alertas

### Estados de asistencia

- `presente`: asistencia normal.
- `tardanza`: cuenta como asistencia en reportes.
- `ausente`: falta no justificada; suma al calculo de riesgo.
- `justificado`: queda registrado, pero no suma como falta de riesgo.

Solo se acepta una marca por estudiante y fecha. Un nuevo envio para esa combinacion actualiza el estado, la observacion y conserva la unicidad. La fecha de negocio se obtiene con `CURRENT_DATE` de PostgreSQL; no se acepta una fecha futura.

### Clasificacion de riesgo

La funcion pura esta en `src/alertas.js`; las consultas y persistencia estan en `src/routes/seguimiento.js`.

1. Se cuentan las ausencias no justificadas y las tardanzas en una ventana inclusiva de 30 dias, terminando en la fecha actual de PostgreSQL.
2. Se calcula la racha maxima con fechas distintas de ausencias consecutivas. Fechas repetidas no alargan la racha y el calculo no se rompe al cambiar de ano.
3. Cuatro o mas tardanzas agregan un punto al puntaje de faltas.
4. Nivel alto: cinco o mas puntos de ausencia/tardanza o racha de al menos tres dias consecutivos.
5. Nivel medio: tres o cuatro puntos, si no se alcanzo nivel alto.
6. Nivel bajo: menos de tres puntos y racha menor de tres dias.

La explicacion guardada incluye ausencias, tardanzas y racha cuando aplican. Al recalcular, se actualiza la alerta pendiente del dia en vez de duplicarla. Si el riesgo vuelve a bajo, las alertas pendientes del estudiante se marcan como atendidas para conservar el historial.

## 5. Modulos de la interfaz

| Modulo | Vista | Descripcion |
|---|---|---|
| Inicio de sesion | `views/login.ejs` | Formulario de acceso con respuesta generica ante credenciales invalidas. |
| Panel | `views/dashboard.ejs` | Resumen general para admin y resumen limitado a sus secciones para docente. |
| Asistencia | `views/asistencia.ejs` | Seleccion de seccion y fecha, lista de estudiantes activos, estados, observaciones y guardado. |
| Alertas | `views/alertas.ejs` | Niveles, evidencia, filtros y accion para atender. |
| Reportes | `views/reportes.ejs` | Indicadores, graficos y detalle individual dentro del rango seleccionado. |
| Gestion | `views/gestion.ejs` | Pestanas para cursos, secciones, estudiantes, docentes y administradores. Acceso exclusivo de admin. |
| Cuenta | `views/cuenta.ejs` | Actualizacion del perfil y contrasena, junto al resumen de la cuenta actual. |
| Edicion | `views/editar.ejs` | Formulario de edicion para registros gestionados por coordinacion. |

La barra comun esta en `views/partials/nav.ejs`. Los estilos compartidos y especificos por pagina estan en `assets/css/estilos.css`. Los scripts de interaccion de asistencia, navegacion y Gestion estan en `assets/js/`.

### Interaccion de Gestion

Las pestanas y filtros de tabla se implementan en `assets/js/gestion.js`. La asignacion de docentes de una seccion es un selector desplegable con casillas multiples; el resumen indica cuantos estan seleccionados. Los nombres de campo y sus valores se procesan en el servidor como `docente_ids`.

## 6. Arquitectura

La aplicacion es un monolito Node.js organizado por responsabilidad, con vistas renderizadas en el servidor:

```text
Navegador / aplicacion Android
             |
             v
        Express 5
   rutas y middleware
       /          \
      v            v
 vistas EJS     PostgreSQL (Neon)
      |
 CSS, JS e iconos
```

- **Runtime:** Node.js 22 o superior, modulos ES y Express 5.
- **Presentacion:** EJS en servidor, Bootstrap 5 y hoja CSS propia.
- **Persistencia:** PostgreSQL mediante `pg`, con TLS y verificacion del certificado.
- **Sesiones:** `express-session` con store PostgreSQL propio.
- **Aplicacion movil:** Capacitor 8 para Android; el contenedor carga la URL HTTPS del servidor.
- **Despliegue web:** Render configurado en `render.yaml`; PostgreSQL alojado en Neon.

No se usa ORM ni una aplicacion frontend separada. La logica del servidor y los permisos permanecen en Node; el cliente solo presenta formularios y vistas.

## 7. Estructura del repositorio

```text
src/
  alertas.js             Clasificacion pura del riesgo y rachas
  config.js              Validacion y normalizacion de configuracion
  db.js                  Pool PostgreSQL y helper de consultas
  security.js            CSRF, sesion, usuario activo y permisos
  session-store.js       Persistencia y limpieza de sesiones
  sql.js                 Separacion segura de sentencias para el instalador
  server.js              Express, middleware, autenticacion y rutas principales
  routes/
    seguimiento.js       Cuenta, asistencia, alertas y reportes
    administracion.js    Gestion protegida por rol admin
views/                   Plantillas EJS
views/partials/           Fragmentos compartidos, como navegacion
assets/css/               Estilos propios
assets/js/                Interacciones del navegador
assets/icons/             Iconos locales
sql/                      Esquema, demo y migraciones PostgreSQL
tools/                    Instalador de base de datos
tests/                    Pruebas automaticas de reglas, seguridad y vistas
docs/                     Guias operativas y documentacion
memoria/                  Decisiones e historia tecnica del equipo
android/                  Proyecto nativo generado para Capacitor
www/                      Directorio web configurado para Capacitor
```

## 8. Rutas HTTP principales

Todas las operaciones que modifican informacion usan `POST`, requieren sesion y token CSRF. La tabla resume las rutas; las comprobaciones de propiedad se realizan en el servidor.

| Metodo | Ruta | Acceso | Uso |
|---|---|---|---|
| `GET` | `/login` | Publico | Muestra inicio de sesion; redirige si ya inicio sesion. |
| `POST` | `/login` | Publico + limite + CSRF | Valida cuenta activa y contrasena. |
| `POST` | `/logout` | Sesion + CSRF | Invalida sesion y cookie. |
| `GET` | `/` | Login | Panel de resumen. |
| `GET` | `/cuenta` | Login | Perfil y resumen de cuenta. |
| `POST` | `/cuenta/perfil` | Login + CSRF | Actualiza nombre, cedula o usuario propios tras confirmar contrasena actual. |
| `POST` | `/cuenta/clave` | Login + CSRF | Cambia contrasena propia y regenera sesion. |
| `GET`, `POST` | `/asistencia` | Login; docente limitado por seccion | Lista o registra asistencia de la seccion. |
| `GET` | `/alertas` | Login; docente limitado por seccion | Consulta alertas con filtros `nivel` y `estado`. |
| `POST` | `/alertas/recalcular` | Solo admin + CSRF | Recalcula alertas de estudiantes activos. |
| `POST` | `/alertas/:id/atender` | Login + CSRF; docente propietario | Atiende alerta con nota breve. |
| `GET` | `/reportes` | Login; docente limitado por seccion | Consulta registros por fechas, curso y seccion. |
| `GET` | `/gestion` | Solo admin | Lista registros para administracion. |
| `GET`, `POST` | `/gestion/editar/:tipo/:id` | Solo admin; POST con CSRF | Edita seccion, estudiante, docente o administrador. |
| `POST` | `/gestion/cursos` | Solo admin + CSRF | Crea o edita cursos. |
| `POST` | `/gestion/cursos/:id/eliminar` | Solo admin + CSRF | Elimina curso solo si no tiene secciones. |
| `POST` | `/gestion/secciones` | Solo admin + CSRF | Crea o edita seccion y asignaciones docentes. |
| `POST` | `/gestion/secciones/:id/eliminar` | Solo admin + CSRF | Elimina seccion solo si no tiene estudiantes. |
| `POST` | `/gestion/estudiantes` | Solo admin + CSRF | Crea o edita estudiante. |
| `POST` | `/gestion/estudiantes/:id/desactivar` | Solo admin + CSRF | Desactiva preservando historial. |
| `POST` | `/gestion/docentes` | Solo admin + CSRF | Crea docente o actualiza cuenta. |
| `POST` | `/gestion/docentes/:id/desactivar` | Solo admin + CSRF | Desactiva si no tiene secciones asignadas. |
| `POST` | `/gestion/administradores` | Solo admin + CSRF | Crea cuenta administradora; el rol se fija en servidor. |
| `POST` | `/gestion/administradores/:id/desactivar` | Solo admin + CSRF | Desactiva sin permitir quitar el ultimo admin activo o a si mismo. |
| `GET` | `/health` | Publico | Comprueba conexion con `SELECT 1` y responde JSON. |

## 9. Modelo de datos

El esquema vigente esta en `sql/schema.sql`; las sesiones se definen en `sql/sesiones.sql`.

| Tabla | Contenido y restricciones clave |
|---|---|
| `usuarios` | Nombre, cedula, usuario unico, hash de contrasena, rol (`admin`/`docente`), estado activo y fecha de creacion. |
| `cursos` | Nombre unico y descripcion opcional. |
| `secciones` | Curso, nombre, ano escolar; nombre unico dentro del curso. |
| `seccion_docentes` | Relacion varios-a-varios entre secciones y docentes. Clave primaria compuesta. |
| `estudiantes` | Nombre, apellido, numero de lista de 1 a 40, fecha opcional, seccion y estado activo. Lista unica dentro de la seccion. |
| `asistencia` | Estudiante, fecha, estado permitido, observacion, usuario que registro; unica por estudiante y fecha. |
| `alertas` | Estudiante, nivel, conteos de 30 dias, racha, explicacion, fecha de deteccion, estado y usuario que atendio. |
| `sesiones` | ID de sesion opaco, expiracion Unix y sesion serializada en JSON. |

Las llaves foraneas y restricciones `CHECK` refuerzan integridad en PostgreSQL. Los indices principales aceleran busquedas por fecha, docente asignado y alertas por estado/fecha.

## 10. Seguridad y privacidad

- Contraseas guardadas con bcrypt; nunca se guarda la clave en texto plano.
- Inicio de sesion limitado a 10 intentos por ventana de 15 minutos.
- Cookie de sesion `HttpOnly`, `SameSite=Lax` y `Secure` en despliegue HTTPS.
- Session ID regenerado al autenticar y al cambiar contrasena; cierre elimina la fila.
- La cuenta se vuelve a consultar en PostgreSQL por cada solicitud autenticada; una cuenta inactiva pierde la sesion.
- Middleware CSRF valida tokens de 256 bits en formularios mutables.
- Consultas SQL parametrizadas con `$1`, `$2`, etc.; el servidor valida formato, rango, fecha, estado y relaciones.
- Helmet aplica Content Security Policy; los scripts y recursos locales siguen la politica del proyecto.
- Los errores al usuario son genericos; el log solo informa codigo o tipo de error.
- La conexion PostgreSQL exige TLS y valida el certificado.
- `.env`, respaldos, hashes demo privados y registros personales no se suben a Git.
- Estudiantes y docentes con historial se desactivan; no se borran en cascada.

No incluir informacion identificable de menores en capturas, tickets, pruebas publicas o archivos del repositorio. Antes de usar datos reales, confirmar autorizacion institucional y revisar accesos entre cuentas.

## 11. Configuracion local y comandos

### Requisitos

- Windows 10/11 o un sistema capaz de ejecutar Node.js.
- Node.js 22 o superior y npm.
- Base PostgreSQL con permiso para instalar el esquema.

### Variables de entorno

La configuracion se centraliza en `src/config.js` y se carga desde `.env`.

| Variable | Requerida | Uso |
|---|---|---|
| `DATABASE_URL` | Si | URI PostgreSQL. `sslmode=require` se eleva a `verify-full`. |
| `SESSION_SECRET` | Si | Secreto de sesion de al menos 32 caracteres. |
| `NODE_ENV` | No | `production` activa cookies seguras y confianza en el proxy. |
| `PORT` | No | Puerto HTTP, por defecto `3000`. |
| `HOST` | No | Se ignora; Node escucha en `0.0.0.0` para funcionar detras del proxy. |
| `RENDER` | Automatico en Render | Tambien activa ajustes seguros de hosting. |
| `CAPACITOR_SERVER_URL` | No | URL HTTPS que abre la app Android; tiene un valor de respaldo en `capacitor.config.ts`. |

No copiar secretos a `README`, capturas, commits o parametros de comandos que queden en historial.

### Instalacion y ejecucion

Desde PowerShell, en la raiz:

```powershell
npm ci
npm run db:setup
npm run check
npm test
npm run dev
```

Abre `http://localhost:3000`. Para una ejecucion normal sin recarga automatica, usa `npm start`.

Scripts definidos:

| Comando | Funcion |
|---|---|
| `npm start` | Ejecuta el servidor. |
| `npm run dev` | Ejecuta Node con reinicio al cambiar archivos. |
| `npm run check` | Ejecuta `node --check` sobre los modulos y pruebas listados. |
| `npm test` | Ejecuta las pruebas integradas con `node --test`. |
| `npm run db:setup` | Instala o verifica esquema, datos demo y migraciones. |
| `npm run mobile:sync` | Sincroniza recursos y plugins con el proyecto Android. |
| `npm run mobile:open` | Abre Android Studio con el proyecto movil. |

## 12. Instalador y migraciones

`tools/instalar.js` lee la misma `DATABASE_URL` que el sistema. Si el esquema esta completo, conserva registros, aplica migraciones necesarias y asegura la tabla de sesiones. En una base vacia crea esquema y escenario ficticio. Si encuentra un esquema parcial, se detiene para evitar perdida accidental.

Migraciones incluidas:

- `sql/migracion_numero_lista.sql`: adapta la estructura anterior del estudiante a numero de lista.
- `sql/migracion_docentes_seccion.sql`: preserva asignaciones existentes y migra la relacion para admitir varios docentes.
- `sql/datos_demo.sql`: datos ficticios del escenario demostrativo.

La reinstalacion forzada elimina tablas. Solo debe ejecutarse tras hacer un respaldo y confirmar expresamente:

```powershell
npm run db:setup -- --forzar --confirmar
```

No usar la opcion destructiva sobre datos reales.

## 13. Pruebas y calidad

La suite `tests/` cubre:

- Umbrales, conteos y rachas de alertas, incluido cambio de ano y entradas invalidas.
- Validacion de configuracion y seguridad de sesion/CSRF.
- Persistencia y expiracion de sesiones.
- Separacion de sentencias SQL.
- Compilacion de vistas EJS y presencia de elementos de interfaz esperados.
- Controles de algunas reglas administrativas y acceso a secciones.

Comandos recomendados antes de integrar cambios:

```powershell
npm run check
npm test
```

Las pruebas unitarias no sustituyen las pruebas manuales con PostgreSQL y navegador. Pendientes relevantes descritos por el equipo: pruebas HTTP sistematicas de autorizacion entre secciones y validacion de usabilidad con consentimiento de docentes/estudiantes.

## 14. Despliegue web

`render.yaml` declara un servicio Node en Render:

- Build: `npm ci`
- Start: `npm start`
- Health check: `/health`
- Secretos: `DATABASE_URL` y `SESSION_SECRET`, configurados fuera de Git.

El servidor escucha en `0.0.0.0` y usa `PORT`. En hosting se habilitan cookies `Secure` y confianza en un proxy. Neon almacena los datos. No ejecutar el instalador en cada despliegue; se usa una vez para una base vacia o cuando haya una migracion planificada.

## 15. Aplicacion Android con Capacitor

La configuracion actual esta en `capacitor.config.ts`, con ID `com.sistema.asistencia`, nombre `Sistema Asistencia`, `webDir` `www` y una URL remota HTTPS. La app necesita internet y el servidor publicado disponible; no incluye una copia offline del servidor Express ni de PostgreSQL.

Flujo local documentado:

```powershell
npm ci
npm run mobile:sync
npm run mobile:open
```

Android Studio, JDK y Android SDK deben estar instalados para compilar/ejecutar el proyecto nativo. La configuracion revisada incluye plataforma Android; no hay plataforma iOS configurada en este repositorio. La compilacion iOS requeriria incorporar esa plataforma y un entorno macOS con Xcode.

## 16. Descripcion de la demo

El escenario esperado contiene 3 cursos, 4 secciones, 20 estudiantes, 50 registros de asistencia y 4 alertas pendientes. El calculo usa la fecha actual de PostgreSQL. No reemplazar el seed ni los hashes demo sin verificar el resultado esperado y las pruebas.

Las credenciales de demostracion se documentan en la guia de instalacion local y solo deben utilizarse con datos ficticios. Cambiar credenciales antes de cualquier uso real.

## 17. Documentos relacionados

- `README.md`: resumen, instalacion, despliegue y estado del producto.
- `docs/instalacion-local.md`: configuracion detallada de entorno local.
- `docs/base-de-datos.md`: tablas y reglas de persistencia.
- `docs/manual-usuario.md`: flujos para docentes y coordinacion.
- `docs/guia-pruebas.md`: casos de prueba funcionales y de permisos.
- `docs/guia-defensa.md`: material para presentar y explicar el proyecto.
- `memoria/decisiones.md`: registro historico de decisiones del equipo.

Al cambiar una regla de negocio, el esquema, la seguridad o la arquitectura, actualizar tambien los documentos relacionados. `memoria/decisiones.md` es historico: agregar decisiones nuevas sin borrar las anteriores.
