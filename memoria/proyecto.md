# Proyecto: Asistencia Escolar Inteligente

## Objetivo

Resolver el descubrimiento tardio del ausentismo con registro escolar simple y alertas
explicables. El proyecto se presenta a una competencia distrital de Bachillerato Tecnico y lo
desarrollan tres integrantes.

## Rubrica y estado

| Criterio | Pts | Implementacion / evidencia |
|---|---:|---|
| Problema real y relevancia | 20 | Entrevistas/validacion escolar; faltan resultados reales |
| Logica y algoritmos | 20 | Clasificacion y racha en `src/alertas.js`; pruebas unitarias |
| Funcionalidad y base de datos | 20 | PostgreSQL Neon, relaciones, CRUD y upsert; falta prueba HTTP completa |
| Innovacion | 15 | Alertas automaticas por ausencias y rachas consecutivas |
| Interfaz y experiencia | 10 | EJS, Bootstrap 5 y CSS; falta prueba de uso con personas |
| Pruebas y calidad | 10 | 42 pruebas locales; falta validar roles/objetos por HTTP |
| Presentacion y defensa | 5 | Guia actualizada; los tres deben explicar todos los modulos |

## Reglas de negocio

1. `justificado` no cuenta como falta de riesgo.
2. 3 ausencias no justificadas en 30 dias generan nivel medio.
3. 5 ausencias o racha de 3 dias generan nivel alto.
4. 4 o mas tardanzas agregan un punto; tardanza cuenta como asistencia en reportes.
5. Si el riesgo deja de existir, se atienden automaticamente alertas pendientes.
6. Se conserva historial: estudiantes y docentes se desactivan, no se borran.
7. Una asistencia por estudiante y fecha; guardar de nuevo actualiza.
8. La fecha de negocio procede de `CURRENT_DATE` de PostgreSQL.

## Arquitectura vigente

Node.js 22+, Express 5, EJS, `pg`, sesiones PostgreSQL y Bootstrap 5. `src/config.js` carga
`DATABASE_URL` y el secreto desde `.env`; TLS valida el certificado del servidor. La URI real
no se versiona. El codigo PHP heredado se retiro; `.htaccess` mantiene el bloqueo de respaldo.

## Estado y pendientes

La conexion a Neon se verifico y el instalador creo: 3 cursos, 4 secciones, 20 estudiantes,
50 marcas, 4 alertas y sesiones. La URI se compartio en una conversacion; rotar su clave antes
de almacenar datos reales.

- Probar rutas HTTP con acceso cruzado entre docentes, estudiantes y alertas.
- Repetir `npm run db:setup` para confirmar que conserva datos y sesiones existentes.
- Validar movil/escritorio y tareas con docentes/estudiantes en menos de siete dias.
- Repartir responsabilidades de analisis/diseno, programacion/datos e interfaz/pruebas; todos
  revisan y explican el sistema.
