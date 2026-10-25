# Guia de pruebas

Ejecuta primero las pruebas Node locales:

```powershell
npm ci
npm run check
npm test
```

La suite automatizada tiene 42 pruebas: reglas y fechas, configuracion PostgreSQL, controles de
seguridad, store de sesiones, parser SQL y compilacion EJS. La conexion con Neon ya se verifico con
`SELECT 1`; el instalador creo el escenario de demostracion. Aun faltan pruebas HTTP de
autorizacion por objeto y validacion escolar con usuarios.

## Integracion PostgreSQL

1. Configura `DATABASE_URL` y `SESSION_SECRET` en `.env`; nunca los incluyas en capturas o logs.
2. Ejecuta `npm run db:setup`; conserva datos si las tablas existen y falla ante esquemas parciales.
3. Comprueba 3 cursos, 4 secciones, 20 estudiantes, 50 asistencias y 4 alertas pendientes.
4. Arranca `npm start` y abre `http://localhost:3000`.
5. Anota fecha, perfil, pasos, esperado/obtenido y resultado; utiliza datos ficticios.

## Acceso y cero confianza

| Caso | Accion | Resultado esperado |
|---|---|---|
| A1 | Iniciar como admin y como cada docente | bcrypt valida y el rol se carga desde PostgreSQL |
| A2 | Iniciar con clave erronea | Respuesta generica sin revelar si existe la cuenta |
| A3 | Superar 10 intentos de login en 15 min | Rate limit detiene solicitudes adicionales |
| A4 | Enviar POST sin CSRF o con token alterado | HTTP 403; no cambia ningun dato |
| A5 | Desactivar cuenta en PostgreSQL y pedir ruta protegida | La sesion se invalida al volver a consultar el usuario |
| A6 | Docente A solicita seccion de docente B | HTTP 403; no se muestran estudiantes |
| A7 | Docente A incluye estudiante ajeno en asistencia | Solicitud rechazada y transaccion revertida |
| A8 | Docente A intenta atender alerta ajena | HTTP 403; alerta sigue pendiente |
| A9 | Alterar `rol`, `docente_id` o `usuario_id` en POST | No cambia el permiso ni el alcance |
| A10 | Usar GET en rutas de mutacion | No se ejecuta ninguna modificacion |
| A11 | Cerrar sesion y usar boton atras | Las rutas protegidas vuelven a login |
| A12 | Cambiar clave con actual incorrecta o confirmacion distinta | Rechaza cambio |
| A13 | Cambiar clave correctamente | Guarda hash bcrypt y regenera sesion |

## Negocio y flujos

| Caso | Accion | Resultado esperado |
|---|---|---|
| B1 | Revisar el demo recien instalado | 3 cursos, 4 secciones, 20 estudiantes, 50 marcas y 4 alertas |
| B2 | Repetir curso, numero de lista en la seccion, cedula de docente o usuario | Mensaje amigable por SQLSTATE `23505` |
| B3 | Eliminar curso con secciones | Operacion bloqueada |
| B4 | Desactivar estudiante/docente con historial | Conserva historial y bloquea login del docente inactivo |
| C1 | Guardar estados de una seccion | Solo acepta lista completa de estudiantes activos de esa seccion |
| C2 | Enviar estado, ID o fecha invalida/futura | Rechaza la transaccion completa |
| C3 | Guardar de nuevo estudiante/fecha | `ON CONFLICT` actualiza; no duplica |
| C4 | Observacion mayor de 255 caracteres | Se limita a 255 caracteres |
| D1 | Recalcular el demo | Dos alertas altas y dos medias pendientes |
| D2 | Tres ausencias consecutivas | Nivel alto |
| D3 | Tres ausencias salteadas | Nivel medio |
| D4 | Falta justificada | No suma al riesgo |
| D5 | Atender alerta sin nota | Solicitud rechazada |
| D6 | Recalcular dos veces | No duplica alertas del dia |
| E1 | Filtrar reporte por curso/seccion/fecha | Solo devuelve registros del filtro y rol permitido |
| E2 | Comparar tardanzas y justificados | Tardanza cuenta como asistencia; justificado no como riesgo |
| E3 | Rango sin marcas | Porcentaje 0, sin division por cero |
| F1 | Probar tildes y texto HTML | Se escapa el contenido; no se ejecuta HTML ingresado |
| F2 | Abrir en 375px y escritorio | Formularios, menu y tablas utilizables |

## Resultado

```text
Fecha / version:
Perfil:
Caso:
Esperado / obtenido:
Resultado: pasa / falla
Mejora o incidencia:
```

No adjuntes contrasenas, `.env`, URI PostgreSQL, capturas con datos personales ni respaldos.
La validacion escolar requiere consentimiento y minimizacion de datos.
