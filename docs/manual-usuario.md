# Manual de usuario

El servidor Node se abre desde `http://localhost:3000`. Hay dos roles: coordinacion (`admin`) y
docente. El servidor vuelve a comprobar el estado de la cuenta y el permiso de cada objeto en
cada solicitud; el menu no es un control de seguridad.

## 1. Iniciar sesion

1. Abre la direccion local del sistema.
2. Escribe usuario y contrasena.
3. Pulsa **Iniciar sesion**. Ante un error, confirma los datos con la coordinacion.
4. Para salir, pulsa **Salir**. La sesion queda invalidada.
5. Para cambiar tu contrasena, abre **Cuenta**, confirma la actual y escribe una nueva de al
   menos 4 caracteres. Al guardar se regenera la sesion.

Las cuentas demo `admin / 12345678`, `profesor1 / profe123` y `profesor2 / profe123` son
publicas y se usan solo en la demostracion ficticia. No deben usarse para datos reales.

## 2. Panel

El panel resume los cursos, secciones, docentes, estudiantes y alertas para coordinacion. El
docente ve cantidades calculadas solo a partir de sus secciones asignadas.

## 3. Registrar asistencia

1. Abre **Asistencia** y selecciona una seccion y fecha.
2. Marca un estado para cada estudiante activo: `presente`, `tardanza`, `ausente` o
   `justificado`.
3. Si hace falta, agrega una observacion breve.
4. Pulsa **Guardar y recalcular alertas**.

Un docente solo puede registrar asistencia para sus secciones. El servidor rechaza una lista
incompleta, estados no permitidos o identificadores de estudiantes de otra seccion. Guardar el
mismo estudiante y fecha actualiza el registro existente. No se aceptan fechas futuras.

`justificado` no cuenta como ausencia de riesgo. `tardanza` cuenta como asistencia en los
reportes.

## 4. Alertas

La alerta incluye el nivel, los conteos y una explicacion. Tres ausencias sin justificar en 30
dias generan nivel medio; cinco ausencias o tres dias consecutivos generan nivel alto. Cuatro o
mas tardanzas agregan un punto. Al guardar asistencia se recalcula el riesgo de esos estudiantes.

El docente solo ve y atiende alertas de sus estudiantes. Para atender una alerta, escribe la
accion tomada y pulsa **Atender**. Coordinacion puede volver a calcular todas las alertas.

## 5. Reportes

Abre **Reportes**, selecciona el rango de fechas y, si se necesita, filtra por curso o seccion.
La pagina muestra dos reportes visuales ademas de la tabla: un pastel con la distribucion de
registros (asistencias, tardanzas, ausencias y justificadas) y barras con el porcentaje de
asistencia por curso. En la tabla, cada estudiante muestra los dias registrados, asistencias,
tardanzas, ausencias justificadas y no justificadas, y una barra verde que se llena segun su
porcentaje de asistencia. Tardanza cuenta como asistencia; justificado no.

## 6. Gestion (solo coordinacion)

En **Gestion** se crean cursos y secciones, se registran estudiantes y docentes, y se desactivan
cuentas o estudiantes sin borrar el historial. No se permite eliminar cursos con secciones ni
secciones con estudiantes. Las cuentas de docentes se crean con una contrasena de al menos 4
caracteres.

## 7. Reportar un problema

Anota la fecha, el perfil usado, la tarea y el resultado esperado/obtenido. No incluyas
contrasenas, capturas con informacion personal ni datos reales de menores en reportes publicos.
