# Explicacion sencilla del sistema

Esta guia sirve para entender y presentar el proyecto sin empezar por detalles de codigo.
Describe el comportamiento actual del sistema.

## La idea en una frase

El sistema permite que el personal registre la asistencia y encuentre a tiempo patrones de
ausencias que conviene revisar.

## El recorrido de una asistencia

1. Un docente inicia sesion. El sistema consulta la cuenta en la base de datos y muestra solo
   las secciones asignadas a esa persona.
2. El docente elige una seccion y registra un estado por estudiante: presente, tardanza,
   ausente o justificado.
3. El servidor revisa los datos y los permisos. Si el registro es valido, PostgreSQL lo guarda.
   Si ya existe una marca para ese estudiante y ese dia, se actualiza esa marca.
4. Al calcular alertas, el sistema cuenta las ausencias sin justificar, las tardanzas recientes
   y los dias consecutivos con ausencia.
5. La alerta muestra el nivel y los conteos que ayudan a entender por que aparecio. El personal
   puede revisar el caso y dejar constancia de que lo atendio.

## Como se calcula el riesgo

La regla mira los ultimos 30 dias. Una ausencia justificada no suma como falta; una tardanza
cuenta como asistencia en los reportes.

| Evidencia | Efecto |
|---|---|
| 3 o 4 puntos | Riesgo medio |
| 5 o mas puntos | Riesgo alto |
| 3 dias consecutivos de ausencia | Riesgo alto |
| 4 o mas tardanzas | Agrega 1 punto al puntaje |

El puntaje empieza con la cantidad de ausencias sin justificar. Las tardanzas agregan un punto
en total cuando se llega a cuatro; no agregan un punto por cada tardanza. Una racha de tres dias
consecutivos genera riesgo alto por si sola. El programa conserva los conteos para mostrar la
razon de cada alerta.

La regla esta en `src/alertas.js`. Las consultas que obtienen y guardan esos datos estan en
`src/routes/seguimiento.js`.

## Quien puede ver cada cosa

- **Docente:** registra asistencia y consulta alertas y reportes de sus secciones asignadas.
- **Administrador o coordinacion:** gestiona cursos, secciones, estudiantes y cuentas, y puede
  consultar el resumen general.
- **Servidor:** vuelve a comprobar la cuenta y el permiso para cada solicitud. El navegador no
  decide el rol ni puede ampliar el acceso por enviar otro identificador.

## Donde esta cada parte

| Parte | Archivo o carpeta | En palabras simples |
|---|---|---|
| Inicio y conexion de las piezas | `src/server.js` | Prepara la web, las sesiones y las rutas principales. |
| Regla de alertas | `src/alertas.js` | Convierte conteos en nivel y explicacion. |
| Permisos y proteccion de solicitudes | `src/security.js` | Comprueba sesion, cuenta activa, acceso y token CSRF. |
| Conexion a PostgreSQL | `src/db.js` | Ejecuta consultas parametrizadas. |
| Asistencia, alertas y reportes | `src/routes/seguimiento.js` | Atiende las funciones del trabajo diario. |
| Gestion de datos escolares | `src/routes/administracion.js` | Permite las tareas de coordinacion. |
| Pantallas | `views/` | Muestra formularios y resultados. |
| Tablas y relaciones | `sql/schema.sql` | Define como se organiza la informacion. |

## Terminos que se usan al explicar el proyecto

- **Ruta:** una accion de la pagina que el servidor sabe atender, como guardar asistencia.
- **Base de datos:** el lugar donde se guardan cuentas, secciones, asistencias y alertas.
- **Consulta parametrizada:** una consulta que envia el texto SQL y los valores por separado;
  asi los datos escritos por una persona no se convierten en instrucciones SQL.
- **Sesion:** la forma en que la pagina recuerda que una persona ya inicio sesion.
- **CSRF:** una proteccion que exige una clave de formulario valida antes de aceptar cambios.
- **Alerta explicable:** una alerta que muestra sus conteos y el motivo de su nivel.

## Guion breve para presentar

> Primero registramos la asistencia con cuatro estados. El docente solo puede trabajar con sus
> secciones. Luego el sistema revisa las ausencias sin justificar y las rachas en una ventana de
> 30 dias. Si encuentra un patron que cumple las reglas, crea una alerta y muestra los conteos
> que la explican. Coordinacion y docentes pueden revisar el caso, y el sistema conserva el
> historial de asistencia y de atencion.

Para la demostracion, conviene seguir este orden: entrar como docente, registrar o consultar una
asistencia, abrir una alerta y explicar sus conteos; luego entrar como administrador y mostrar la
gestion. Usar solo las cuentas y datos ficticios preparados para la demo.

## Limites que se deben contar con honestidad

- La alerta ayuda a priorizar una revision; no determina por que falta un estudiante ni reemplaza
  la conversacion con su familia o el criterio del plantel.
- La aplicacion Android abre el sitio publicado y necesita internet.
- La validacion con docentes y estudiantes debe realizarse con autorizacion, sin guardar datos
  personales innecesarios y documentando las mejoras encontradas.
