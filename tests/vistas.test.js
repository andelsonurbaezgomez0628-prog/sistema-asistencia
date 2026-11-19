import prueba from 'node:test';
import afirmar from 'node:assert/strict';
import { readFile as leerArchivo } from 'node:fs/promises';
import { fileURLToPath as convertirUrlArchivoARuta } from 'node:url';
import plantillasEjs from 'ejs';

const vistas = [
  'views/login.ejs',
  'views/dashboard.ejs',
  'views/error.ejs',
  'views/asistencia.ejs',
  'views/alertas.ejs',
  'views/reportes.ejs',
  'views/reporte-estudiante.ejs',
  'views/gestion.ejs',
  'views/editar.ejs',
  'views/cuenta.ejs',
  'views/partials/nav.ejs',
];

for (const ruta of vistas) {
  prueba(`la vista ${ruta} compila`, async () => {
    const plantilla = await leerArchivo(new URL(`../${ruta}`, import.meta.url), 'utf8');
    afirmar.doesNotThrow(() => plantillasEjs.compile(plantilla, { filename: ruta }));
  });
}

prueba('asistencia nombra los campos con el id sin corchetes numericos', async () => {
  // Express convierte estado[7] en un arreglo y pierde el id del estudiante.
  const plantilla = await leerArchivo(new URL('../views/asistencia.ejs', import.meta.url), 'utf8');
  afirmar.match(plantilla, /name="estado_<%= estudiante\.id %>"/);
  afirmar.match(plantilla, /name="observacion_<%= estudiante\.id %>"/);
  afirmar.doesNotMatch(plantilla, /name="estado\[/);
  afirmar.doesNotMatch(plantilla, /name="observacion\[/);
});

prueba('reportes incluye barra de porcentaje y graficos de pastel y barras', async () => {
  // La barra de avance y los graficos evitan estilos en linea para respetar la CSP.
  const plantilla = await leerArchivo(new URL('../views/reportes.ejs', import.meta.url), 'utf8');
  afirmar.match(plantilla, /class="barra-asistencia" max="100" value="<%= porcentaje %>"/);
  afirmar.match(plantilla, /class="grafico-dona"/);
  afirmar.match(plantilla, /class="grafico-barras"/);
  afirmar.doesNotMatch(plantilla, /style="/);
  afirmar.match(plantilla, /data-exportacion-general/);
  afirmar.match(plantilla, /data-fila-exportacion/);
  afirmar.match(plantilla, /data-exportar="excel">Excel/);
});

prueba('detalle de estudiante renderiza historial y datos de navegacion', async () => {
  const html = await plantillasEjs.renderFile(convertirUrlArchivoARuta(new URL('../views/reporte-estudiante.ejs', import.meta.url)), {
    estudiante: { nombre: 'Estudiante', apellido: 'Demo', numero_lista: 1, curso: 'Curso', seccion: 'A' },
    historial: [{ fecha: '2026-11-01', estado: 'presente', observacion: null }],
    desde: '2026-10-01', hasta: '2026-11-02', hoy: '2026-11-02',
    usuario: { id: 1, nombre: 'Docente', rol: 'docente' }, rutaActual: '/reportes/estudiantes/1', csrfToken: 'token-demo', flash: null,
  });
  afirmar.match(html, /Historial de asistencia/);
  afirmar.match(html, /Presente/);
  afirmar.match(html, /Volver a reportes/);
  afirmar.match(html, /Exportar PDF/);
  afirmar.match(html, /Exportar Excel/);
  afirmar.match(html, /Exportar Word/);
});

prueba('las rutas de reportes usan el alias en minusculas que devuelve PostgreSQL', async () => {
  // PostgreSQL dobla los nombres sin comillas: "inicioDefecto" llegaba como undefined
  // y dejaba el rango de reportes vacio o rompia el detalle del estudiante.
  const rutas = await leerArchivo(new URL('../src/routes/seguimiento.js', import.meta.url), 'utf8');
  afirmar.match(rutas, /AS inicio_defecto/);
  afirmar.doesNotMatch(rutas, /AS inicioDefecto/);
});

prueba('el detalle del estudiante no falla si una fecha llega vacia', async () => {
  // Una fecha invalida antes lanzaba RangeError y devolvia la pagina de error 500.
  const html = await plantillasEjs.renderFile(convertirUrlArchivoARuta(new URL('../views/reporte-estudiante.ejs', import.meta.url)), {
    estudiante: { nombre: 'Estudiante', apellido: 'Demo', numero_lista: 1, curso: 'Curso', seccion: 'A' },
    historial: [{ fecha: 'sin-fecha', estado: 'presente', observacion: null }],
    desde: undefined, hasta: undefined, hoy: undefined,
    usuario: { id: 1, nombre: 'Docente', rol: 'docente' }, rutaActual: '/reportes/estudiantes/1', csrfToken: 'token-demo', flash: null,
  });
  afirmar.match(html, /Historial de asistencia/);
  afirmar.match(html, /Volver a reportes/);
});

prueba('la alerta recibe las fechas de ausencia como texto y no como Date', async () => {
  // ARRAY_AGG(fecha) devuelve objetos Date, pero la regla de rachas espera YYYY-MM-DD;
  // al guardar la lista con ausencias lanzaba TypeError y se perdia el guardado.
  const rutas = await leerArchivo(new URL('../src/routes/seguimiento.js', import.meta.url), 'utf8');
  afirmar.match(rutas, /ARRAY_AGG\(fecha::text ORDER BY fecha\)/);
  afirmar.doesNotMatch(rutas, /ARRAY_AGG\(fecha ORDER BY fecha\)/);
});

prueba('gestion renderiza la pestana para crear administradores', async () => {
  const html = await plantillasEjs.renderFile(convertirUrlArchivoARuta(new URL('../views/gestion.ejs', import.meta.url)), {
    cursos: [],
    secciones: [],
    estudiantes: [],
    docentes: [],
    administradores: [{ id: 1, nombre: 'Ana', cedula: '40101010', usuario: 'admin', activo: true }],
    csrfToken: 'token-demo',
    flash: null,
    usuario: { id: 1, nombre: 'Ana', rol: 'admin' },
    rutaActual: '/gestion',
  });
  afirmar.match(html, /id="panel-administradores"/);
  afirmar.match(html, /action="\/gestion\/administradores"/);
  afirmar.match(html, /Crear administrador/);
});

prueba('editar seccion muestra varios docentes y marca los que ya estan asignados', async () => {
  const html = await plantillasEjs.renderFile(convertirUrlArchivoARuta(new URL('../views/editar.ejs', import.meta.url)), {
    tipo: 'seccion',
    registro: { id: 4, nombre: 'A', anio_escolar: '2026-2027', curso_id: 2 },
    cursos: [{ id: 2, nombre: 'Quinto' }],
    secciones: [],
    docentes: [
      { id: 7, nombre: 'Docente Uno', activo: true },
      { id: 8, nombre: 'Docente Dos', activo: true },
    ],
    docentesAsignados: [7, 8],
    csrfToken: 'token-demo',
    flash: null,
    usuario: { id: 1, nombre: 'Admin', rol: 'admin' },
    rutaActual: '/gestion/editar/seccion/4',
  });
  afirmar.equal((html.match(/name="docente_ids"/g) || []).length, 2);
  afirmar.equal((html.match(/checked/g) || []).length, 2);
});

prueba('asistencia ofrece marcar presentes a toda la lista', async () => {
  const html = await plantillasEjs.renderFile(convertirUrlArchivoARuta(new URL('../views/asistencia.ejs', import.meta.url)), {
    secciones: [{ id: 3, nombre: 'A', curso: 'Quinto' }],
    estudiantes: [{ id: 9, nombre: 'Eva', apellido: 'Prueba', numero_lista: 1, estado: null, observacion: null }],
    idSeccion: 3,
    fecha: '2026-10-26',
    hoy: '2026-10-26',
    csrfToken: 'token-demo',
    flash: null,
    usuario: { id: 2, nombre: 'Docente', rol: 'docente' },
    rutaActual: '/asistencia',
  });
  const script = await leerArchivo(new URL('../assets/js/asistencia.js', import.meta.url), 'utf8');
  const estilos = await leerArchivo(new URL('../assets/css/estilos.css', import.meta.url), 'utf8');
  afirmar.match(html, /data-marcar-todos-presentes/);
  afirmar.match(html, /data-estado-asistencia/);
  afirmar.match(html, /data-aviso-marcar-presentes/);
  afirmar.match(html, /data-conteo-estado="presente"/);
  afirmar.match(html, /Lista N°/);
  afirmar.match(script, /Se marcaron/);
  afirmar.match(script, /Desmarcar todos/);
  afirmar.match(script, /todaLaListaEstaPresente/);
  afirmar.match(script, /estado-\$\{estado\}/);
  afirmar.match(script, /function actualizarContadores\(\)/);
  afirmar.match(script, /actualizarContadores\(\);/);
  afirmar.match(html, /aria-pressed="false"/);
  afirmar.match(html, /data-texto-masivo/);
  afirmar.match(estilos, /\.asistencia-boton-masivo\[aria-pressed="true"\]/);
  afirmar.match(estilos, /\.estado-selector\.estado-presente \{ border-color: #A7F3D0; background: var\(--asist-verde-claro\);/);
  afirmar.match(estilos, /\.estado-selector\.estado-ausente \{ border-color: #FECACA; background: var\(--asist-rojo-claro\);/);
  afirmar.match(estilos, /\.estado-selector\.estado-justificado \{ border-color: #BFDBFE; background: var\(--asist-azul-claro\);/);
  afirmar.match(estilos, /\.estado-selector\.estado-tardanza \{ border-color: #FDE68A; background: var\(--asist-naranja-claro\);/);
  afirmar.match(html, /src="\/js\/asistencia\.js"/);
});

prueba('el PDF imprime un informe propio y no la pagina de pantalla', async () => {
  const reportes = await leerArchivo(new URL('../views/reportes.ejs', import.meta.url), 'utf8');
  const estudiante = await leerArchivo(new URL('../views/reporte-estudiante.ejs', import.meta.url), 'utf8');
  const estilos = await leerArchivo(new URL('../assets/css/estilos.css', import.meta.url), 'utf8');
  const script = await leerArchivo(new URL('../assets/js/reportes.js', import.meta.url), 'utf8');

  afirmar.match(reportes, /class="pdf-reporte"/);
  afirmar.match(estudiante, /class="pdf-reporte"/);
  afirmar.doesNotMatch(reportes, /style="/);
  // Al imprimir solo queda visible el informe; el resto de la pagina se oculta.
  afirmar.match(estilos, /body > \*:not\(\.pdf-reporte\) \{ display: none !important; \}/);
  afirmar.match(estilos, /\.pdf-reporte \{ display: block !important; \}/);
  afirmar.match(estilos, /\.pdf-tabla thead \{ display: table-header-group; \}/);
  afirmar.match(script, /imprimirComoPdf/);
});

prueba('reportes renderiza el informe PDF con los totales del rango', async () => {
  const html = await plantillasEjs.renderFile(convertirUrlArchivoARuta(new URL('../views/reportes.ejs', import.meta.url)), {
    desde: '2026-10-01', hasta: '2026-11-02', hoy: '2026-11-02',
    filas: [{
      id: 9, nombre: 'Eva', apellido: 'Prueba', numero_lista: 1, curso: 'Quinto', seccion: 'A',
      asistencias: 10, tardanzas: 1, ausencias: 2, justificadas: 1, dias_registrados: 14, tiene_foto: false,
    }],
    resumenRegistros: { presentes: 10, tardanzas: 1, ausencias: 2, justificadas: 1 },
    totalRegistros: 14,
    asistenciaGeneral: 79,
    resumenCursos: [],
    cursos: [{ id: 1, nombre: 'Quinto' }],
    secciones: [{ id: 2, nombre: 'A', curso_id: 1, curso: 'Quinto' }],
    idCurso: 1,
    idSeccion: 2,
    usuario: { id: 1, nombre: 'Docente', rol: 'docente' },
    rutaActual: '/reportes', csrfToken: 'token-demo', flash: null,
  });

  afirmar.match(html, /class="pdf-reporte"/);
  afirmar.match(html, /Prueba, Eva/);
  afirmar.match(html, /pdf-resumen-item pdf-verde/);
  afirmar.match(html, /Reporte de asistencia/);
});

prueba('las paginas incluyen barra de carga y bloqueo del doble envio del login', async () => {
  const head = await leerArchivo(new URL('../views/partials/head.ejs', import.meta.url), 'utf8');
  const login = await leerArchivo(new URL('../views/login.ejs', import.meta.url), 'utf8');
  const carga = await leerArchivo(new URL('../assets/js/carga.js', import.meta.url), 'utf8');
  const scriptLogin = await leerArchivo(new URL('../assets/js/login.js', import.meta.url), 'utf8');
  const estilos = await leerArchivo(new URL('../assets/css/estilos.css', import.meta.url), 'utf8');

  afirmar.match(head, /src="\/js\/carga\.js"/);
  afirmar.match(carga, /barra-carga-pagina/);
  afirmar.match(login, /data-boton-login/);
  afirmar.match(login, /data-texto-login/);
  afirmar.match(login, /src="\/js\/login\.js"/);
  afirmar.match(scriptLogin, /evento\.preventDefault\(\)/);
  afirmar.match(estilos, /\.barra-carga-pagina/);
});

prueba('la barra superior muestra el rol del usuario', async () => {
  const html = await plantillasEjs.renderFile(convertirUrlArchivoARuta(new URL('../views/partials/nav.ejs', import.meta.url)), {
    usuario: { id: 2, nombre: 'Docente', rol: 'docente' },
    rutaActual: '/asistencia',
    csrfToken: 'token-demo',
  });
  afirmar.match(html, /navbar-user-role/);
  afirmar.match(html, />Docente<\/span>/);
  afirmar.match(html, /class="navbar-user navbar-user-link[^\"]*" href="\/cuenta"/);
  afirmar.doesNotMatch(html, /class="nav-item-icon[^\"]*" href="\/cuenta"/);
});

prueba('cuenta permite editar datos personales y presenta el resumen de la cuenta actual', async () => {
  const html = await plantillasEjs.renderFile(convertirUrlArchivoARuta(new URL('../views/cuenta.ejs', import.meta.url)), {
    error: null,
    flash: null,
    csrfToken: 'token-demo',
    cuentaActual: { id: 8, nombre: 'María Prueba', cedula: '12345678', usuario: 'maria.prueba', rol: 'docente', activo: true },
    valoresPerfil: null,
    usuario: { id: 8, nombre: 'María Prueba', rol: 'docente' },
    rutaActual: '/cuenta',
  });
  afirmar.match(html, /action="\/cuenta\/perfil"/);
  afirmar.match(html, /name="nombre"/);
  afirmar.match(html, /name="cedula"/);
  afirmar.match(html, /name="usuario"/);
  afirmar.match(html, /name="clave_actual_perfil"/);
  afirmar.match(html, /Cuenta actual/);
  afirmar.match(html, /maria\.prueba/);
  afirmar.match(html, /Administrador|Docente/);
  afirmar.match(html, /action="\/cuenta\/clave"/);
});
