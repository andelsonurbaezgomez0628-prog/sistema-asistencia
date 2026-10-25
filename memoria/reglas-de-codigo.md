# Reglas de codigo

Codigo legible para nivel Bachillerato Tecnico. Identificadores ASCII; textos de interfaz pueden
llevar tildes. Los tres integrantes revisan cambios y explican todos los modulos.

## Stack y estructura

- Node.js 22+, Express, EJS, PostgreSQL Neon, `pg` y Bootstrap 5.
- Rutas en `src/routes/`, conexion comun en `src/db.js`, configuracion en `src/config.js`, regla
  de alertas en `src/alertas.js` y plantillas en `views/`.
- Usar `const`, `async/await`, funciones pequenas y SQL parametrizado con `$1`, `$2`, etc.
- No agregar ORM, frontend separado, TypeScript, Docker o servicios extra sin necesidad probada.
- PHP/Apache no son runtime. El legado PHP se retiro; no reintroducirlo sin justificar necesidad.

## Cero confianza

1. Revalidar en PostgreSQL que la cuenta exista y siga activa en cada solicitud autenticada.
2. Autorizar accion y objeto en servidor. Docentes acceden solo a sus secciones, estudiantes y
   alertas; los datos del formulario nunca deciden el rol.
3. Validar IDs, enums, fechas, longitudes, rangos y relaciones en servidor.
4. En SQL usar `$n` para valores; no concatenar entradas de formularios.
5. Mutaciones por POST/PUT/PATCH/DELETE con CSRF; GET no cambia datos.
6. Contraseñas con bcrypt; nunca registrar secretos ni devolver SQL.
7. Sesiones en PostgreSQL, regeneradas al autenticar, expiradas e invalidadas al salir o desactivar
   la cuenta. Cookies HttpOnly/SameSite y Secure en produccion.
8. TLS valida certificado completo. URI y `SESSION_SECRET` solo en `.env`, ignorado por Git.
9. Usar datos ficticios; minimizar datos personales de menores.

## Negocio y PostgreSQL

- `justificado` no cuenta como falta de riesgo; tardanza si cuenta en reportes.
- 3 ausencias en 30 dias: medio; 5 ausencias o racha de 3 dias: alto; 4 tardanzas suman punto.
- `CURRENT_DATE` de PostgreSQL es la fecha de negocio; no usar reloj local de Node.
- Upsert: `ON CONFLICT (estudiante_id, fecha) DO UPDATE`.
- Contadores por estado: `COUNT(*) FILTER (WHERE ...)`; activo es `BOOLEAN`.
- Docentes/estudiantes con historial se desactivan. No borrar registros historicos.

## Verificacion

- `npm test` despues de cambios de logica; `npm run check` antes de integrar.
- Cambios SQL requieren instalacion limpia y repetida sin perdida de datos.
- Probar accesos negados a objetos de otra seccion, no solo el flujo exitoso de admin.
- Actualizar README, guias y memoria si cambia stack, seguridad o reglas.
- Validar con docentes y estudiantes con consentimiento en menos de siete dias.
