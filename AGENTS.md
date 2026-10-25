# AGENTS.md - Reglas del proyecto Asistencia Escolar Inteligente

Lee estas reglas antes de modificar codigo. El sistema debe resolver un problema real, poder
demostrarse y ser explicable por los tres integrantes.

## 1. Objetivo y alcance

- Registrar asistencia, tardanzas, ausencias y faltas justificadas.
- Detectar inasistencia recurrente y explicar cada alerta.
- Filtrar por curso, seccion y fecha; generar reportes y estadisticas.
- Coordinacion gestiona cursos, secciones, estudiantes y docentes.
- Validar usabilidad con docentes y estudiantes en menos de siete dias.
- Usar alertas tempranas explicables y minimizar los datos de menores.

## 2. Stack acordado

- Node.js 22 LTS o superior, Express, EJS y Bootstrap 5.
- PostgreSQL alojado en Neon; la conexion se configura en `DATABASE_URL` dentro de `.env`.
- `pg` usa consultas parametrizadas con `$1`, `$2`, etc.
- Toda configuracion comun vive en `src/config.js`; no duplicar lectura de variables en rutas.
- `npm` administra dependencias, pruebas e instalador. No introducir ORM, frontend separado,
  TypeScript, Docker o servicios adicionales sin necesidad demostrada.
- No usar PHP/Apache como runtime. El codigo PHP heredado se retiro del proyecto; Node es el
  unico runtime y `.htaccess` conserva el bloqueo como red de seguridad.

## 3. Codigo para nivel Bachillerato Tecnico

- Funciones pequenas, nombres descriptivos y comentarios en espanol para reglas no obvias.
- Identificadores ASCII; textos de usuario pueden llevar tildes.
- Preferir `const`, `async/await`, arreglos y ciclos explicables.
- Separar rutas HTTP, consultas y reglas de negocio sin capas innecesarias.
- La clasificacion de alertas vive en un solo modulo y conserva funciones puras con pruebas.
- Los Markdown se escriben sin tildes, segun la convencion del equipo.

## 4. Cero confianza: reglas obligatorias

Cada solicitud y objeto se valida en servidor; la identidad de sesion no concede acceso general.

1. Autenticar rutas protegidas y comprobar que la cuenta siga activa en PostgreSQL.
2. Autorizar cada accion y objeto. El docente solo accede a sus secciones, estudiantes y alertas.
3. Nunca aceptar `rol`, `usuario_id`, `docente_id` ni permisos del formulario como autoridad.
4. Validar tipos, rangos, fechas, enumeraciones y relaciones en servidor.
5. Usar placeholders `$n` para datos. No interpolar entradas en SQL.
6. Contraseñas con bcrypt y comparacion segura; no guardar texto plano ni revelar errores SQL.
7. Sesiones persistidas en PostgreSQL, regeneradas al autenticar, expiradas e invalidadas al salir
   o desactivar la cuenta. Cookies `HttpOnly`, `SameSite` y `Secure` en produccion.
8. Formularios mutables por POST/PUT/PATCH/DELETE con CSRF. GET nunca modifica datos.
9. Limitar intentos de login, usar Helmet/CSP y registrar solo codigos de error, nunca secretos.
10. Mantener `.env` fuera de Git. La URI PostgreSQL y `SESSION_SECRET` son secretos.
11. Usar TLS con verificacion del certificado y datos ficticios en desarrollo/demostracion.
12. Minimizar datos personales de menores y probar limites de acceso entre cuentas docentes.

## 5. Reglas de negocio

- `justificado` no suma como falta de riesgo.
- `tardanza` cuenta como asistencia en reportes y 4 o mas tardanzas en 30 dias suman un punto.
- 3 ausencias no justificadas en 30 dias generan nivel medio; 5 o racha de 3 dias, nivel alto.
- Estudiantes/docentes con historial se desactivan, no se borran fisicamente.
- Un registro por estudiante y fecha; `ON CONFLICT (estudiante_id, fecha)` actualiza la fila.
- La fecha de negocio se obtiene de PostgreSQL (`CURRENT_DATE`), no del reloj de Node.

## 6. Equipo y validacion

- Analisis/diseno: requisitos, entrevistas y flujo de pantallas.
- Programacion/datos: reglas, rutas, SQL y seguridad.
- Interfaz/pruebas: usabilidad, escenarios, errores y mejoras.
- Los tres revisan cambios y pueden explicar todos los modulos.
- Probar con consentimiento de docentes/estudiantes en menos de siete dias; registrar tarea,
  resultado y mejora sin datos personales innecesarios.

## 7. Verificacion

- `npm test` despues de cambios de logica; `npm run check` antes de entregar.
- Para cambios de BD, probar instalacion limpia y actualizacion sin perdida de datos.
- La demo conserva 3 cursos, 4 secciones, 20 estudiantes y 4 alertas esperadas.
- Las pruebas de permisos deben intentar acceder a objetos de otra seccion.
- Actualizar README, guias y `memoria/` si cambian stack, seguridad o reglas.

## 8. Datos sensibles

- No publicar `.env`, SQL privado, respaldos ni registros con datos personales.
- No reemplazar hashes demo ni cambiar escenarios de `sql/datos_demo.sql` sin comprobar el efecto.
- `memoria/decisiones.md` es historico: agregar decisiones; no borrar las anteriores.
