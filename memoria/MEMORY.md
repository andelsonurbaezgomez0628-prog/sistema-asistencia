# 🧠 Memoria del proyecto

Notas internas del equipo. **Se lee antes de programar** y se actualiza al terminar
cada avance. No es documentación para el usuario: es la memoria de *por qué* las cosas
son como son.

| Archivo | De qué habla |
|---|---|
| [`proyecto.md`](proyecto.md) | Qué hay que lograr (requisitos de la competencia) y dónde se cumple cada punto |
| [`reglas-de-codigo.md`](reglas-de-codigo.md) | Cómo escribimos código en este proyecto |
| [`base-de-datos.md`](base-de-datos.md) | Resumen rápido del modelo de datos y sus reglas de integridad |
| [`decisiones.md`](decisiones.md) | Registro de decisiones: qué elegimos y **por qué** |

## Estado del proyecto

**Fase actual (2026-10-25):** runtime Node.js + PostgreSQL Neon. El instalador se ejecuto con la
URI local y reporto 3 cursos, 4 secciones, 20 estudiantes, 50 asistencias y 4 alertas. El login,
asistencia, alertas, reportes, gestion y cambio de clave estan en Node; el codigo PHP heredado se
retiro del proyecto y solo `.htaccess` conserva el bloqueo de respaldo. La URI fue compartida en
una conversacion: rotar la clave en Neon antes de cargar datos reales. Faltan pruebas HTTP de
permisos y validacion con docentes/estudiantes.

| Módulo | Estado |
|---|---|
| Servidor Node, sesion PostgreSQL, CSRF y cabeceras seguras | ✔ escrito / ☐ prueba HTTP |
| Login y permisos por solicitud | ✔ implementacion / ☐ prueba de acceso cruzado |
| CRUD cursos / docentes / secciones / estudiantes | ✔ implementacion / ☐ regresion HTTP |
| Asistencia transaccional y upsert PostgreSQL | ✔ implementacion / ☐ regresion HTTP |
| Algoritmo Node + alertas y atencion | ✔ 12 pruebas puras / ☐ regresion HTTP |
| Reportes por curso/seccion/fecha | ✔ implementacion / ☐ comparar filtros HTTP |
| Datos demo con `CURRENT_DATE` y secuencias PostgreSQL | ✔ instalado en Neon |
| Instalador Node PostgreSQL protegido | ✔ instalado / ☐ probar ejecucion repetida |
| TLS de URI y secretos `.env` | ✔ conexion verificada / pendiente rotar URI compartida |
| Pruebas continuas en GitHub Actions | ✔ actualizado / ☐ primera corrida |
| Pruebas automatizadas Node (42) | ✔ pasan localmente / ☐ CI |
| Pruebas de seguridad por rol y objeto | ☐ pendiente por HTTP |
| Documentacion Node + PostgreSQL | △ README, instalacion, BD, pruebas y defensa actualizados |
| Validación con docentes y representantes | ☐ **pendiente** (rúbrica pide problema real) |

## Pendientes / mejoras anotadas

1. Rotar la URI/clave de Neon compartida y actualizar `.env` local.
2. Ejecutar pruebas HTTP para acceso cruzado entre docentes y todas las operaciones mutables.
3. Validar tareas con docentes/estudiantes en menos de siete dias y registrar resultados reales.
4. Cambiar las claves demo antes de cualquier uso con datos reales.
5. Boton "marcar todos presentes" y notificacion al representante solo con consentimiento.
6. Definir nombre del equipo y completar entrevistas reales.

## Cómo mantener esta memoria

- ¿Cambiaste un umbral del algoritmo? → actualiza `decisiones.md` y `proyecto.md`.
- ¿Agregaste una regla de validación? → `reglas-de-codigo.md`.
- ¿Terminaste una entrega? → mueve la casilla de "Estado del proyecto".
- Regla de oro: **el "por qué" vive aquí; el "cómo" vive en el código y en `docs/`.**


## Avance visual anterior (2026-10-24)

- Se actualizo `assets/css/estilos.css` con un tema profesional azul marino, azul de acento, fondos suaves, tarjetas, tablas, formularios, botones y estados de alerta.
- Se modernizo `includes/header.php`: barra superior oscura, marca visual y estados activos del menu, conservando enlaces segun rol.
- Se modernizo `login.php`; esa pantalla corresponde al runtime PHP anterior.
- La nueva interfaz EJS reutiliza los estilos de `assets/css/estilos.css`. Falta revision visual en
   navegador movil y escritorio tras conectar PostgreSQL.

## Limpieza del legado PHP (2026-10-25)

- Se retiraron los 29 archivos PHP heredados, las carpetas `includes/` y `config/` (solo tenian
  legado) y `tools/instalar.php`; el instalador vigente es `tools/instalar.js`.
- Se elimino `tests/pruebas.php`; las pruebas vigentes son `tests/*.test.js`.
- Se actualizaron AGENTS, README y memoria para reflejar que Node es el unico runtime.
- Respaldo recuperable en `%TEMP%\opencode\legado-php-20261025.zip` (fuera del repositorio).

## Correccion del formulario de asistencia (2026-10-25)

- **Sintoma:** al guardar la lista, el servidor respondia 403 "La lista contiene un estudiante o estado no permitido".
- **Causa:** los campos se llamaban `estado[<id>]`. El parser de formularios de Express trata los corchetes numericos como arreglo, compacta los valores y pierde el id; la relacion estudiante-estado se rompia.
- **Arreglo:** `views/asistencia.ejs` usa `estado_<id>` y `observacion_<id>`; la ruta recorre los estudiantes permitidos y lee esos campos. Prueba de regresion en `tests/vistas.test.js`.
- **Verificacion:** guardado real en una instancia aparte (302 y observacion persistida); datos demo restaurados a 50 marcas y 4 alertas.
