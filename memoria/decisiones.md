# Decisiones de diseño (y su porqué)

Formato: **Decisión** → por qué → qué descartamos. Esto es lo que responde las preguntas
incómodas del jurado. Fecha de cada decisión: fase de desarrollo inicial.

## 1. Stack

**PHP + MySQL con PDO, sin frameworks.** *(decision de la fase inicial; la seccion 7 cuenta la
excursion por PostgreSQL y la seccion 8 registra la vuelta a MySQL, que es la decision vigente)*
- *Por qué:* es lo que se ve en la lista de tecnologías sugeridas de la competencia, lo que
  el docente de informática puede mantener, y lo que los tres integrantes pueden explicar
  línea por línea.
- *Descartado:* Laravel (requiere Composer y conceptos de ORM que el equipo no domina),
  Node/Express (otra pila completa), y la opción "HTML + localStorage" (no demuestra base de
  datos con relaciones, que vale 20 puntos en la rúbrica).

**Bootstrap 5 por CDN.**
- *Por qué:* ganamos interfaz adaptable (10 puntos de UX) sin escribir CSS complejo ni
  instalar nada.
- *Descartado:* CSS propio completo (costoso y estéticamente peor) y npm (el equipo no usa
  herramientas de build).

## 2. El modelo de datos

**UNIQUE (estudiante_id, fecha) en la tabla `asistencia`.**
- *Por qué:* hace material la regla "un estudiante tiene un solo estado por día" y permite el
  `ON DUPLICATE KEY UPDATE` que corrige sin duplicar. (Durante la etapa PostgreSQL fue
  `ON CONFLICT (estudiante_id, fecha) DO UPDATE`; la idea es la misma, solo cambia la sintaxis.)
- *Descartado:* borrar-y-volver-a-insertar (pierde `creado_el` y auditoría de quién registró).

**Cuatro estados, con `justificado` separado de `ausente`.**
- *Por qué:* un estudiante enfermo con constancia no es un caso de ausentismo; mezclarlos
  llenaría el sistema de alertas falsas y le quitaría confianza al docente.
- *Consecuencia:* el algoritmo **cuenta solo `ausente`**. Está documentado en el código y en la guía.

**`alertas` guarda los números del cálculo (`faltas_30_dias`, `racha_maxima`).**
- *Por qué:* la alerta debe poder explicarse y auditarse ("¿por qué me avisaron?"), no ser
  un simple "sí/no". Le da peso a la defensa del algoritmo.

**Retirar en vez de eliminar (`activo = 0`) en docentes y estudiantes.**
- *Por qué:* borrar a un estudiante con historial rompería reportes de meses anteriores.
- *Descartado:* borrado en cascada (destruye datos que el plantel necesita).

**Fechas como `DATE` y año escolar como texto `2025-2026`.**
- *Por qué:* la asistencia es un hecho por día, no por hora; y el año escolar es un período,
  no un número (no tiene sentido sumarle 1).

## 3. El algoritmo de alertas

**Recalcular al guardar (no un cron).**
- *Por qué:* en XAMPP un cron es poco confiable, difícil de explicar y no muestra nada en la
  demo. Recalcular al guardar hace que el jurado **vea nacer la alerta** en el mismo clic.
- *Coste asumido:* si alguien registra asistencia de días atrás, las alertas del día actual
  no se recalculan solas → para eso existe el botón "Recalcular todas".

**Días consecutivos ("racha") como disparador ALTO.**
- *Por qué:* es la parte innovadora. Tres faltas repartidas en un mes y tres faltas seguidas
  son problemas distintos: la racha es la señal temprana de deserción.
- *Implementación:* se convierten las fechas a **número de día absoluto**
  (`(int)(strtotime($fecha . ' UTC') / 86400)`), se ordena el arreglo, se quitan repetidos y
  un `for` cuenta la racha. Nada de librerías.
- *Arreglo real que encontramos:* al principio usamos `date('z')` (día dentro del año) y con
  eso el 31/12 y el 1/01 **no** seguían de largo, así que una racha que cruzaba el año se
  cortaba mal. Usando días desde 1970 el conteo es correcto; la prueba nº 10 de
  `tests/pruebas.php` existe para que ese error no vuelva.

**Función pura `clasificar_riesgo()` separada de `calcular_alerta()`.**
- *Por qué:* `clasificar_riesgo()` no toca la base de datos, así que se puede probar en un
  archivo suelto (`tests/pruebas.php`) sin montar nada. Esa separación es lo que hace
  posibles las pruebas automátizadas.

**Umbrales: 3 = medio, 5 o racha 3 = alto, 4+ tardanzas suman 1 punto.**
- *Por qué:* son reglas simples, defendibles y ajustables (`define()` al inicio del archivo).
  Un umbral más fino no se puede justificar sin datos reales del plantel.
- *Cómo se cambió esto:* solo se modifican las constantes y se corre la prueba.

**Auto-cierre: si el riesgo baja, las alertas pendientes pasan a "atendida".**
- *Por qué:* un panel lleno de alertas viejas que ya no aplican deja de ser útil; el sistema
  debe limpiarse solo para que el docente confíe en él.
- *Detalle:* se marca "atendida" (no se borra), para conservar la historia del problema.

**Sin notificaciones a representantes (todavía).**
- *Por qué:* requiere correos/SMS y datos personales que el plantel no nos dio aún.
- *Cómo:* queda como primera mejora en `MEMORY.md`.

## 4. Seguridad

**`password_hash()` / `password_verify()` (bcrypt).**
- *Por qué:* nadie guarda contraseñas en texto plano; bcrypt es la opción nativa de PHP sin
  configuración extra.
- *Nota práctica:* los hashes del `datos_demo.sql` se generaron con bcrypt (prefijo `$2b$`),
  que `password_verify()` acepta junto con `$2y$`.

**Comprobación de permisos en el servidor, además del menú.**
- *Por qué:* esconder el botón no es seguridad. Por eso `asistencia_guardar.php` valida que
  la sección sea del docente y que los ids de estudiantes pertenezcan a esa sección, y
  `alerta_atender.php` comprueba la propiedad de la alerta antes de modificarla.

**CSRF propio con token en sesión (no una librería).**
- *Por qué:* 15 líneas que el equipo puede explicar; una librería externa no se justifica en
  este tamaño de proyecto.

**Escapado con `e()` en toda salida.**
- *Por qué:* el nombre de un estudiante puede ser un `<script>`; es la defensa XSS más barata.

**Errores genéricos al usuario y detalle en `error_log()`.**
- *Por qué:* una página de error con la consulta SQL o la contraseña de la BD filtrando
  información interna es un problema de seguridad real, y al jurado le queda raro verlo.

## 5. Alcance

**Dos roles, no tres.**
- *Por qué:* se propuso un rol "representante" que vería las alertas de su hijo. Sumaba
  validación de parentesco, otro login y más tiempo del que tenemos. Lo que sí demuestra
  permisos (admin vs docente) está cubierto.

**Sin edición masiva, sin importación desde Excel, sin reportes en PDF.**
- *Por qué:* son características "de producto" que no añaden puntos de lógica ni de algoritmo.
  La barra de % imprimible cubre la necesidad de "llevar el reporte a la dirección".

## 6. Nomenclatura

**Funciones en español con snake_case, variables en camelCase, identificadores sin tildes.**
- *Por qué:* el jurado y los usuarios son hispanohablantes; el código habla su idioma.
  Los acentos en identificadores dan problemas de codificación, así que van en comentarios
  y textos, no en nombres.

## 7. Migracion a PostgreSQL y despliegue en la nube (decision posterior)

**Cambiar MySQL por PostgreSQL, reemplazando el codigo (no manteniendo los dos motores).**
- *Por qué:* queriamos una **direccion publica** para que los docentes usen el sistema sin
  instalar nada. Railway entrega PostgreSQL administrado y PHP con Docker; para que el mismo
  codigo corra en el laboratorio y en la nube tenia que haber un solo dialecto.
- *Que se toco:* `config/conexion.php` (lee la variable `DATABASE_URL` de la nube o las
  constantes locales), `sql/schema.sql`, `sql/datos_demo.sql` y las consultas de las paginas
  (`SUM(CASE…)`, `ON CONFLICT`, `CASE` en lugar de `FIELD()`, `ILIKE`, `GROUP BY` completo).
- *Que NO cambio:* ninguna regla de negocio, ninguna pantalla, ningun umbral de alerta. Las
  10 pruebas del algoritmo siguieron en verde sin tocarlas (son funciones puras).
- *Descartado:* mantener dos drivers con `if ($motor == 'mysql')` (duplica cada consulta y
  nadie del equipo podria explicar las dos versiones); SQLite (no sirve para el despliegue
  multiusuario real); GitHub Pages (no ejecuta PHP).

**Un instalador propio (`tools/instalar.php`) en lugar de importar los .sql a mano.**
- *Por qué:* en PostgreSQL no existe phpMyAdmin, y en Railway no hay donde hacer clic para
  "importar". Ademas un solo comando es mas facil de explicar y de repetir el dia de la demo.
- *Detalles de seguridad que se decidieron ahi:* solo corre en consola (rechaza el acceso por
  navegador con 403) y es **idempotente**: si las tablas ya existen, no borra nada. Gracias a
  eso Railway puede lanzarlo en cada arranque del servicio.
- *Descartado:* pegar el SQL en pgAdmin (4 intentos y un error de orden de tablas), o crear
  una "migracion" con framework de BD (inexplicable para el nivel del proyecto).

**Docker + Apache en vez de nginx + PHP-FPM.**
- *Por qué:* una imagen `php:8.2-apache` y un archivo de configuracion de Apache son mas
  faciles de leer para un equipo junior que un pool de FPM mas un server block de nginx.
- *Coste:* Apache consume algo mas de memoria; para un plantel pequeno es irrelevante.

**El `ON CONFLICT` de PostgreSQL exige decirle el nombre de la restriccion (las columnas).**
- *Por qué importa:* `ON DUPLICATE KEY` de MySQL funcionaba "magico"; en PostgreSQL uno
  escribe `ON CONFLICT (estudiante_id, fecha)`. Es mas explicito y al jurado le gusta: la
  consulta **declara cual regla de unicidad** esta aprovechando.
- *Otra trampa de la migracion:* los `SUM(estado = 'ausente')` de MySQL daban error en
  PostgreSQL (no se puede sumar verdadero/falso). Se reemplazaron por `CASE WHEN`, que se lee
  igual de bien y es SQL estandar.

> **Estado de esta seccion (2026-10-18):**queda como registro historico. La migracion se
> **revirtio** al dia siguiente de terminar; leer la seccion 8 para la decision vigente.

## 8. Vuelta a MySQL y eliminacion de la nube (2026-10-18)

**Volver del todo a MySQL / MariaDB: el codigo de PostgreSQL desaparece.**
- *Por que:* la unica razon de existir de PostgreSQL era el despliegue publico en Railway, y
  el proyecto decidio **no** publicar en la nube. Sin nube, MySQL es estrictamente mejor para
  nosotros: XAMPP lo instala y lo arranca solo, el plantel ya lo conoce, phpMyAdmin sirve para
  mirar y respaldar, y no hay que instalar un motor aparte ni explicar `setval` al jurado.
- *Que se toco:* `config/conexion.php` (DSN `mysql:` y `abre_conexion()`, sin lectura de
  `DATABASE_URL`), `sql/schema.sql` (`AUTO_INCREMENT`, `ENUM`, `TINYINT(1)`, `InnoDB`,
  `utf8mb4_unicode_ci`, `UNIQUE KEY`, FK con nombre), `sql/datos_demo.sql`
  (`CURDATE() - INTERVAL n DAY`, sin bloque de secuencias) y las consultas de las paginas:
  `SUM(estado = 'x')`, `ON DUPLICATE KEY UPDATE … VALUES(col)`, `FIELD(nivel, …)`, `LIKE`,
  `GROUP BY` completo (se conserva por `ONLY_FULL_GROUP_BY`).
- *Que NO cambio:* ninguna regla de negocio, ningun umbral, ninguna pantalla. Las 10 pruebas
  del algoritmo siguen en verde sin tocarlas (son funciones puras, ajenas al motor).
- *Verificacion posible aqui:* es **estatica** (lint de sintaxis PHP con php-parser y un puerto
  en JavaScript del separador de sentencias para contar las 12 + 16 sentencias del SQL). Nadie
  ha ejecutado todavia `php tools/instalar.php` contra un MySQL real: es el primer paso
  pendiente en el laboratorio.

**Eliminar `Dockerfile`, `railway.json`, `apache/asistencia.conf`, `.dockerignore` y
`docs/despliegue-railway.md`.**
- *Por que:* un jurado que ve contenedor, nube y dos formas de instalar pregunta por las tres;
  nosotros solo sabemos explicar una. Ademas, mientras el archivo exista alguien del equipo va
  a "probar" el despliegue y va a perder la tarde.
- *Como se recuperaria si algun dia hiciera falta:* el razonamiento esta en la seccion 7 de
  este archivo y en `git log`; habria que volver a escribir el contenedor y probarlo de verdad.

**Los documentos y el SQL se bloquean con `.htaccess`, no con la configuracion del servidor.**
- *Por que:* con XAMPP no podemos pedirle al docente del plantel que edite
  `httpd.conf`; un `.htaccess` viaja dentro de la carpeta del proyecto y se copia solo.
- *Como:* uno en la raiz (`FilesMatch` sobre `md|sql|conf|json|yml` y archivos ocultos) y otro
  con `Require all denied` dentro de `config/`, `includes/`, `sql/`, `tools/`, `docs/` y
  `memoria/`. La prueba G5 de `docs/guia-pruebas.md` lo verifica.
- *Dependencia:* Apache debe tener `AllowOverride All` en el bloque `<Directory htdocs>` (XAMPP
  lo trae asi por defecto); si no, los `.htaccess` se ignoran en silencio.

**`tools/instalar.php` crea la base `asistencia_escolar` si no existe (solo desde consola).**
- *Por que:* en MySQL el usuario `root` de XAMPP tiene permiso de `CREATE DATABASE`, asi que el
  paso de "entrar a phpMyAdmin y crear la base con la codificacion correcta" desaparece. Era el
  paso donde mas se equivocaba la instalacion (bases en `latin1` que rompian las tildes).
- *Seguridad:* el `CREATE DATABASE` esta detras de `php_sapi_name() === 'cli'` y del codigo
  1049 ("unknown database"); por navegador nunca se crea ni se borra nada.

**La red interna es opcional y se documenta, no se automatiza.**
- *Por que:* abrir el firewall y fijar la IP lo hace el tecnico del plantel, no el sistema. Se
  escribio el paso 7 en `docs/instalacion-local.md` con la instruccion `netsh` exacta y la
  advertencia de que Bootstrap viene por CDN (sin Internet se ve sin estilos pero funciona).

## 9. Primera corrida real (2026-10-19) y el bug del reloj doble

**Correr el sistema contra un MySQL de verdad, no solo validar el codigo estaticamente.**
- *Que se hizo:* XAMPP con MariaDB 10.4.32 en esta PC; `php tools/instalar.php --forzar`
  (12 + 16 sentencias, resumen 3/3/4/20/50/4), `tests/pruebas.php` 10/10, `password_verify`
  con los hash `$2b$` del demo (los tres usuarios entran), y el sistema servido por Apache en
  `http://localhost/asistencia` mediante un **junction** de Windows hacia la carpeta del
  proyecto (`C:\xampp\htdocs\asistencia`), no una copia: asi el codigo fuente sigue siendo uno
  solo. Se comprobaron los bloqueos por navegador: `sql/schema.sql`, `README.md` y
  `tools/instalar.php` responden 403.
- *Por que importa:* hasta ese momento nada del proyecto se habia ejecutado nunca contra una
  base de datos. Todo estaba "validado" con un lint de sintaxis y un puerto del separador de
  sentencias escrito en JavaScript.

**Unico reloj para "hoy": el de la base de datos (`hoy_en_base()`), no el de PHP.**
- *El defecto que se encontro:* `calcular_alerta()` buscaba la alerta del dia con
  `date('Y-m-d')` (reloj de PHP) mientras que `datos_demo.sql` la sembraba con `CURDATE()`
  (reloj de MySQL). En esta PC los relojes estaban a **9 horas de diferencia** (PHP
  `Europe/Berlin` = 2026-10-20, MariaDB `UTC-7` = 2026-10-19), asi que la alerta existente no
  aparecia "como de hoy" y la funcion insertaba una segunda: **8 alertas pendientes en lugar de
  4**, duplicando a Pablo, Maria, Luis y Andrea.
- *Arreglo:* `hoy_en_base($pdo)` + `resta_dias()` en `includes/funciones.php`; se usan en
  `includes/alertas_lib.php` (ventana de 30 dias), `asistencia.php` (fecha por defecto y `max`
  del campo) y `reportes.php` (rango por defecto). Se descarto fijar una zona horaria hardcoded
  en `php.ini` o con `date_default_timezone_set()`: funcionaria en esta PC y volveria a romperse
  en la del plantel, porque el problema de fondo eran dos relojes, no la zona elegida.
- *Verificacion:* con los relojes todavia desalineados a proposito, `recalcular_todas()` dos
  veces seguidas deja **exactamente 4 pendientes** (2 ALTAS, 2 MEDIAS) y 0 estudiantes con
  alertas duplicadas. Tambien se probo el upsert: marcar "ausente" a Luisana Torres, que ya
  estaba presente ese dia, deja **una** fila con el estado nuevo (no dos).
- *Como se vigila desde aqui:* casos **G8** y **G9** de `docs/guia-pruebas.md` y la regla de
  codigo "la fecha de hoy la pone la base de datos" en `reglas-de-codigo.md` y `AGENTS.md`.


## 10. Actualizacion visual profesional (2026-10-24)

**Decisión:** mejorar la plantilla compartida y la hoja de estilos sin cambiar la arquitectura ni la logica de negocio.

- **Que cambio:** `assets/css/estilos.css`, `includes/header.php` y la estructura visual de `login.php`.
- **Criterio visual:** azul marino para la navegacion, azul de acento para acciones principales, fondos claros, bordes suaves, tarjetas con radios consistentes y estados activos claros.
- **Por que:** modernizar la interfaz completa de forma centralizada, manteniendo Bootstrap 5 por CDN y evitando dependencias nuevas.
- **Riesgo controlado:** no se modificaron consultas SQL, permisos, algoritmo de alertas, esquema ni datos de demostracion.
- **Pendiente:** ejecutar pruebas automatizadas y revisar todas las paginas en XAMPP; el CSS no sustituye la validacion manual en navegador.

## 11. Migracion incremental a Node.js y cero confianza (2026-10-25)

**Decision:** cambiar la aplicacion de PHP a Node.js 22+, Express, EJS y `mysql2`, conservando
MySQL/MariaDB local de XAMPP. Node sirve las paginas; Apache/PHP dejan de ser necesarios para
la aplicacion nueva. Bootstrap 5 y el esquema/datos demo se conservan.

- **Por que:** se solicita mover toda la logica a Node y formalizar cero confianza. Mantener
  MySQL reduce el riesgo de migrar motor y runtime a la vez y permite comparar resultados.
- **Seguridad:** sesiones persistidas en MySQL, regeneracion al iniciar sesion, CSRF, Helmet,
  rate limit, bcrypt, verificacion de cuenta activa por solicitud, permisos por seccion/objeto,
  consultas parametrizadas y cuenta de aplicacion separada de la cuenta DDL.
- **Operaciones:** el instalador nuevo conserva datos por defecto; `--forzar --confirmar`
  requiere respaldo y es destructivo. No se permite resiembra de demo sobre una base ocupada.
- **Transicion:** no se borran archivos PHP ni datos demo hasta probar paridad en MariaDB. La
  migracion no esta completa: faltan pruebas de integracion, terminar edicion en la UI y
  ejecutar la validacion con docentes/estudiantes en menos de siete dias.
- **Descartado:** PostgreSQL, ORM, frontend separado, nube y Docker. No resuelven una necesidad
  demostrada para el equipo de tres integrantes y el laboratorio escolar.

## 12. PostgreSQL en Neon y configuracion central (2026-10-25)

**Decision:** reemplazar MySQL/MariaDB por PostgreSQL en Neon y usar `pg`. `src/config.js`
centraliza `DATABASE_URL`, secreto de sesion, entorno, host y puerto; los secretos se leen de
`.env`, ignorado por Git. Todas las consultas usan placeholders `$n`, el upsert usa `ON CONFLICT`
y el esquema utiliza identities, booleanos y restricciones `CHECK` de PostgreSQL.

- **Por que:** se solicita usar la base PostgreSQL proporcionada. Mantener un solo motor evita
  duplicar dialectos y permite que el equipo explique una sola implementacion.
- **Seguridad:** TLS con validacion completa, errores sin mostrar URI, sesiones PostgreSQL,
  permisos de objeto y CSRF. La URI fue expuesta en una conversacion; se debe rotar la clave en
  Neon antes de agregar datos reales.
- **Verificacion:** conexion `SELECT 1` confirmada; instalador ejecutado y seed verificado con
  3 cursos, 4 secciones, 20 estudiantes, 50 asistencias y 4 alertas. Siguen pendientes pruebas
  HTTP de autorizacion cruzada y validacion escolar.
- **Transicion:** la decision de MySQL/XAMPP de las secciones anteriores es historica; no se
  borra. Los PHP permanecen como referencia bloqueada por Apache.

## 2026-10-25 - Retiro del legado PHP

**Decision:** eliminar los 29 archivos PHP heredados, las carpetas `includes/` y `config/` (solo
contenian legado), `tools/instalar.php` y `tests/pruebas.php`. Node.js queda como unico runtime.

- **Por que:** el sistema ya funciona completo en Node/Express/EJS y las pruebas vigentes son
  `tests/*.test.js`. Mantener dos implementaciones confunde al jurado y duplica superficie de
  error; ademas, el instalador vigente es `tools/instalar.js`.
- **Que se conserva:** `.htaccess` sigue bloqueando `.php` como red de seguridad, y las
  decisiones historicas de este archivo no se borran.
- **Respaldo:** copia recuperable en `%TEMP%\opencode\legado-php-20261025.zip`, fuera del
  repositorio, por si hace falta comparar durante la defensa.
- **Verificacion:** busqueda de `.php` sin resultados fuera de `node_modules`; `npm test`
  ejecutado despues del retiro.

## 2026-10-25 - Reportes visuales con pastel y barras

**Decision:** en Reportes se agrego una barra verde de progreso por estudiante y dos graficos
(pastel de registros y barras por curso) sobre la tabla existente. Se construyen con HTML, CSS y
SVG generado en EJS, sin librerias externas ni estilos en linea, para respetar la CSP estricta.

- **Por que:** el porcentaje se leia solo como numero y no permitia comparar de un vistazo.
- **Datos:** los graficos se derivan de las mismas filas filtradas, asi coinciden con la tabla.
- **Verificacion:** `npm test`, `npm run check` y render de la vista con datos ficticios.

## 2026-10-25 - Minimo de contrasena de 4 caracteres

**Decision:** bajar de 12 a 4 el minimo de caracteres para cambiar la propia contrasena y para
crear o actualizar cuentas de docentes. El limite se valida en el servidor y en los formularios
(`minlength="4"`).

- **Por que:** lo solicito el equipo para facilitar el uso en la demostracion.
- **Seguridad:** bcrypt, CSRF, rate limit y revalidacion de cuenta se mantienen. Un minimo de 4
  es debil; antes de usar datos reales se recomienda volver a 12 o exigir una clave mas larga.
- **Verificacion:** `npm test` y `npm run check` despues del cambio.

## 2026-10-25 - Alta de administradores desde Gestion

**Decision:** agregar la pestana **Administradores** en Gestion para crear, editar y desactivar
cuentas con rol `admin`. El rol se fija en el servidor (`'admin'` en el INSERT); nunca se lee del
formulario. La ruta sigue protegida por `requerirAdmin`, CSRF, validacion de cedula, usuario y
clave con bcrypt.

- **Reglas:** un administrador no puede desactivar su propia cuenta ni dejar el sistema sin al
  menos un administrador activo. Las cuentas se desactivan, no se borran, para conservar el
  historial de alertas atendidas.
- **Correccion:** la edicion de docentes comparaba `activo === 0` con un booleano, por lo que
  nunca impedia desactivar un docente con secciones asignadas; ahora usa `!activo` y aplica la
  misma validacion que el boton Desactivar.
- **Verificacion:** `npm test` (48 pruebas, incluida la renderizacion de la nueva pestana) y
  `npm run check`.

## 2026-10-26 - Correccion al crear secciones

**Decision:** corregir la validacion de curso y docente al crear o editar una seccion. El codigo
destructuraba solo el primer resultado de `Promise.all` en `relaciones`, por lo que
`relaciones[1]` era una fila de curso y no el arreglo de docentes; con un curso existente se
producia un error 500. Ahora se usan `cursosEncontrados` y `docentesEncontrados` por separado.

- **Verificacion:** `npm test` (49 pruebas, con una regresion que vigila la destructuracion) y
  `npm run check`. Se creo y elimino una seccion de prueba contra la base real sin dejar datos.
