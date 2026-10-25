# Guia de defensa ante el jurado

Guion sugerido: 3 minutos de problema y diseno, 4 de demo, 2 de seguridad/calidad y 1 de limites.
No afirmar entrevistas ni pruebas de usuario que el equipo no haya realizado.

## Antes de presentar

- Confirmar `DATABASE_URL` y `SESSION_SECRET` en `.env`; no proyectar la URI ni abrir ese archivo.
- Ejecutar `npm start` y comprobar `http://localhost:3000`.
- Verificar el resumen demo y las cuentas ficticias; cambiar las claves publicas antes de uso real.
- Ejecutar `npm test` (42 pruebas) y comprobar los permisos con dos docentes.
- Abrir `src/alertas.js`, `src/routes/seguimiento.js`, `src/security.js` y `src/config.js`.

## Demostracion

1. Entrar como `profesor1`; mostrar solo sus secciones.
2. Pasar asistencia y explicar validacion de lista, estudiante, estado y fecha en el servidor.
3. Mostrar una alerta y sus conteos; la racha consecutiva genera nivel alto.
4. Atender una alerta con una nota; queda registro de la accion.
5. Filtrar un reporte por curso, seccion y fecha.
6. Como admin, mostrar gestion y las restricciones de relaciones.
7. Intentar como docente A abrir seccion o alerta de docente B y mostrar el rechazo.
8. Mostrar `npm test`, `npm run check` y el resumen instalado en Neon.

## Algoritmo

```text
ventana: 30 dias
faltas: ausencias no justificadas
score: faltas + 1 si hay 4 o mas tardanzas
racha: maximo de fechas consecutivas

ALTO: score >= 5 o racha >= 3
MEDIO: score >= 3
BAJO: lo demas
```

`src/alertas.js` mantiene funciones puras para la clasificacion y racha. PostgreSQL proporciona
`CURRENT_DATE`, evitando depender de la zona horaria del proceso Node.

## Arquitectura y seguridad

- Node.js 22+, Express y EJS sirven la aplicacion.
- PostgreSQL Neon guarda el modelo relacional y las sesiones.
- `pg` parametriza consultas con `$1`, `$2`, etc.; no se concatenan entradas de formulario.
- `src/config.js` valida la URI y el secreto; `.env` queda ignorado por Git.
- TLS usa verificacion completa del certificado; no se registra la URI.
- bcrypt protege contrasenas; CSRF, regeneracion de sesion, Helmet/CSP y rate limit protegen HTTP.
- En cada solicitud se revalida la cuenta. El docente solo accede a sus secciones y objetos.
- Demo ficticia: 3 cursos, 4 secciones, 20 estudiantes, 50 asistencias y 4 alertas.

La URI que se compartio para configurar la instancia debe rotarse en Neon antes de guardar datos
reales. No mostrar secretos ante el jurado.

## Rubrica y limites

| Criterio | Evidencia | Pendiente real |
|---|---|---|
| Problema real | Alertas tempranas explicables | Registrar entrevistas/validacion con consentimiento |
| Logica y algoritmos | Racha, puntaje, filtros y pruebas | La suite pura no sustituye pruebas de permisos HTTP |
| Base de datos | Relaciones, checks, identity, upsert PostgreSQL | Probar accesos cruzados por rol en cada ruta |
| Innovacion | Alertas por racha y explicacion | No envia avisos externos a representantes |
| Interfaz | EJS, Bootstrap responsive | Validacion visual con docentes y estudiantes |
| Calidad | 42 pruebas Node, check y CI | Pruebas de usuario aun pendientes |
| Presentacion | Reparto de responsabilidades | Los tres integrantes deben explicar todas las partes |

## Equipo de tres

- Analisis/diseno: requisitos, entrevistas, diagramas y experiencia.
- Programacion/datos: consultas, reglas, permisos y seguridad.
- Interfaz/pruebas: pantallas, escenarios, errores y mejoras.

Todos revisan cambios y pueden explicar modelo, algoritmo, permisos y limites.
