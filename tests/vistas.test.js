import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';

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
  test(`la vista ${ruta} compila`, async () => {
    const plantilla = await readFile(new URL(`../${ruta}`, import.meta.url), 'utf8');
    assert.doesNotThrow(() => ejs.compile(plantilla, { filename: ruta }));
  });
}

test('asistencia nombra los campos con el id sin corchetes numericos', async () => {
  // Express convierte estado[7] en un arreglo y pierde el id del estudiante.
  const plantilla = await readFile(new URL('../views/asistencia.ejs', import.meta.url), 'utf8');
  assert.match(plantilla, /name="estado_<%= estudiante\.id %>"/);
  assert.match(plantilla, /name="observacion_<%= estudiante\.id %>"/);
  assert.doesNotMatch(plantilla, /name="estado\[/);
  assert.doesNotMatch(plantilla, /name="observacion\[/);
});

test('reportes incluye barra de porcentaje y graficos de pastel y barras', async () => {
  // La barra de avance y los graficos evitan estilos en linea para respetar la CSP.
  const plantilla = await readFile(new URL('../views/reportes.ejs', import.meta.url), 'utf8');
  assert.match(plantilla, /class="barra-asistencia" max="100" value="<%= porcentaje %>"/);
  assert.match(plantilla, /class="grafico-dona"/);
  assert.match(plantilla, /class="grafico-barras"/);
  assert.doesNotMatch(plantilla, /style="/);
  assert.match(plantilla, /data-exportacion-general/);
  assert.match(plantilla, /data-fila-exportacion/);
  assert.match(plantilla, /data-exportar="excel">Excel/);
});

test('detalle de estudiante renderiza historial y datos de navegacion', async () => {
  const html = await ejs.renderFile(fileURLToPath(new URL('../views/reporte-estudiante.ejs', import.meta.url)), {
    estudiante: { nombre: 'Estudiante', apellido: 'Demo', numero_lista: 1, curso: 'Curso', seccion: 'A' },
    historial: [{ fecha: '2026-11-01', estado: 'presente', observacion: null }],
    desde: '2026-10-01', hasta: '2026-11-02', hoy: '2026-11-02',
    usuario: { id: 1, nombre: 'Docente', rol: 'docente' }, rutaActual: '/reportes/estudiantes/1', csrfToken: 'token-demo', flash: null,
  });
  assert.match(html, /Historial de asistencia/);
  assert.match(html, /Presente/);
  assert.match(html, /Volver a reportes/);
  assert.match(html, /Exportar PDF/);
  assert.match(html, /Exportar Excel/);
  assert.match(html, /Exportar Word/);
});

test('las rutas de reportes usan el alias en minusculas que devuelve PostgreSQL', async () => {
  // PostgreSQL dobla los nombres sin comillas: "inicioDefecto" llegaba como undefined
  // y dejaba el rango de reportes vacio o rompia el detalle del estudiante.
  const rutas = await readFile(new URL('../src/routes/seguimiento.js', import.meta.url), 'utf8');
  assert.match(rutas, /AS inicio_defecto/);
  assert.doesNotMatch(rutas, /AS inicioDefecto/);
});

test('el detalle del estudiante no falla si una fecha llega vacia', async () => {
  // Una fecha invalida antes lanzaba RangeError y devolvia la pagina de error 500.
  const html = await ejs.renderFile(fileURLToPath(new URL('../views/reporte-estudiante.ejs', import.meta.url)), {
    estudiante: { nombre: 'Estudiante', apellido: 'Demo', numero_lista: 1, curso: 'Curso', seccion: 'A' },
    historial: [{ fecha: 'sin-fecha', estado: 'presente', observacion: null }],
    desde: undefined, hasta: undefined, hoy: undefined,
    usuario: { id: 1, nombre: 'Docente', rol: 'docente' }, rutaActual: '/reportes/estudiantes/1', csrfToken: 'token-demo', flash: null,
  });
  assert.match(html, /Historial de asistencia/);
  assert.match(html, /Volver a reportes/);
});

test('la alerta recibe las fechas de ausencia como texto y no como Date', async () => {
  // ARRAY_AGG(fecha) devuelve objetos Date, pero la regla de rachas espera YYYY-MM-DD;
  // al guardar la lista con ausencias lanzaba TypeError y se perdia el guardado.
  const rutas = await readFile(new URL('../src/routes/seguimiento.js', import.meta.url), 'utf8');
  assert.match(rutas, /ARRAY_AGG\(fecha::text ORDER BY fecha\)/);
  assert.doesNotMatch(rutas, /ARRAY_AGG\(fecha ORDER BY fecha\)/);
});

test('gestion renderiza la pestana para crear administradores', async () => {
  const html = await ejs.renderFile(fileURLToPath(new URL('../views/gestion.ejs', import.meta.url)), {
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
  assert.match(html, /id="panel-administradores"/);
  assert.match(html, /action="\/gestion\/administradores"/);
  assert.match(html, /Crear administrador/);
});

test('editar seccion muestra varios docentes y marca los que ya estan asignados', async () => {
  const html = await ejs.renderFile(fileURLToPath(new URL('../views/editar.ejs', import.meta.url)), {
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
  assert.equal((html.match(/name="docente_ids"/g) || []).length, 2);
  assert.equal((html.match(/checked/g) || []).length, 2);
});

test('asistencia ofrece marcar presentes a toda la lista', async () => {
  const html = await ejs.renderFile(fileURLToPath(new URL('../views/asistencia.ejs', import.meta.url)), {
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
  const script = await readFile(new URL('../assets/js/asistencia.js', import.meta.url), 'utf8');
  const estilos = await readFile(new URL('../assets/css/estilos.css', import.meta.url), 'utf8');
  assert.match(html, /data-marcar-todos-presentes/);
  assert.match(html, /data-estado-asistencia/);
  assert.match(html, /data-aviso-marcar-presentes/);
  assert.match(html, /data-conteo-estado="presente"/);
  assert.match(html, /Lista N°/);
  assert.match(script, /Se marcaron/);
  assert.match(script, /Desmarcar todos/);
  assert.match(script, /todaLaListaEstaPresente/);
  assert.match(script, /estado-\$\{estado\}/);
  assert.match(script, /function actualizarContadores\(\)/);
  assert.match(script, /actualizarContadores\(\);/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /data-texto-masivo/);
  assert.match(estilos, /\.asistencia-boton-masivo\[aria-pressed="true"\]/);
  assert.match(estilos, /\.estado-selector\.estado-presente \{ border-color: #A7F3D0; background: var\(--asist-verde-claro\);/);
  assert.match(estilos, /\.estado-selector\.estado-ausente \{ border-color: #FECACA; background: var\(--asist-rojo-claro\);/);
  assert.match(estilos, /\.estado-selector\.estado-justificado \{ border-color: #BFDBFE; background: var\(--asist-azul-claro\);/);
  assert.match(estilos, /\.estado-selector\.estado-tardanza \{ border-color: #FDE68A; background: var\(--asist-naranja-claro\);/);
  assert.match(html, /src="\/js\/asistencia\.js"/);
});

test('el PDF imprime un informe propio y no la pagina de pantalla', async () => {
  const reportes = await readFile(new URL('../views/reportes.ejs', import.meta.url), 'utf8');
  const estudiante = await readFile(new URL('../views/reporte-estudiante.ejs', import.meta.url), 'utf8');
  const estilos = await readFile(new URL('../assets/css/estilos.css', import.meta.url), 'utf8');
  const script = await readFile(new URL('../assets/js/reportes.js', import.meta.url), 'utf8');

  assert.match(reportes, /class="pdf-reporte"/);
  assert.match(estudiante, /class="pdf-reporte"/);
  assert.doesNotMatch(reportes, /style="/);
  // Al imprimir solo queda visible el informe; el resto de la pagina se oculta.
  assert.match(estilos, /body > \*:not\(\.pdf-reporte\) \{ display: none !important; \}/);
  assert.match(estilos, /\.pdf-reporte \{ display: block !important; \}/);
  assert.match(estilos, /\.pdf-tabla thead \{ display: table-header-group; \}/);
  assert.match(script, /imprimirComoPdf/);
});

test('reportes renderiza el informe PDF con los totales del rango', async () => {
  const html = await ejs.renderFile(fileURLToPath(new URL('../views/reportes.ejs', import.meta.url)), {
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

  assert.match(html, /class="pdf-reporte"/);
  assert.match(html, /Prueba, Eva/);
  assert.match(html, /pdf-resumen-item pdf-verde/);
  assert.match(html, /Reporte de asistencia/);
});

test('las paginas incluyen barra de carga y bloqueo del doble envio del login', async () => {
  const head = await readFile(new URL('../views/partials/head.ejs', import.meta.url), 'utf8');
  const login = await readFile(new URL('../views/login.ejs', import.meta.url), 'utf8');
  const carga = await readFile(new URL('../assets/js/carga.js', import.meta.url), 'utf8');
  const scriptLogin = await readFile(new URL('../assets/js/login.js', import.meta.url), 'utf8');
  const estilos = await readFile(new URL('../assets/css/estilos.css', import.meta.url), 'utf8');

  assert.match(head, /src="\/js\/carga\.js"/);
  assert.match(carga, /barra-carga-pagina/);
  assert.match(login, /data-boton-login/);
  assert.match(login, /data-texto-login/);
  assert.match(login, /src="\/js\/login\.js"/);
  assert.match(scriptLogin, /evento\.preventDefault\(\)/);
  assert.match(estilos, /\.barra-carga-pagina/);
});

test('la barra superior muestra el rol del usuario', async () => {
  const html = await ejs.renderFile(fileURLToPath(new URL('../views/partials/nav.ejs', import.meta.url)), {
    usuario: { id: 2, nombre: 'Docente', rol: 'docente' },
    rutaActual: '/asistencia',
    csrfToken: 'token-demo',
  });
  assert.match(html, /navbar-user-role/);
  assert.match(html, />Docente<\/span>/);
  assert.match(html, /class="navbar-user navbar-user-link[^\"]*" href="\/cuenta"/);
  assert.doesNotMatch(html, /class="nav-item-icon[^\"]*" href="\/cuenta"/);
});

test('cuenta permite editar datos personales y presenta el resumen de la cuenta actual', async () => {
  const html = await ejs.renderFile(fileURLToPath(new URL('../views/cuenta.ejs', import.meta.url)), {
    error: null,
    flash: null,
    csrfToken: 'token-demo',
    cuentaActual: { id: 8, nombre: 'María Prueba', cedula: '12345678', usuario: 'maria.prueba', rol: 'docente', activo: true },
    valoresPerfil: null,
    usuario: { id: 8, nombre: 'María Prueba', rol: 'docente' },
    rutaActual: '/cuenta',
  });
  assert.match(html, /action="\/cuenta\/perfil"/);
  assert.match(html, /name="nombre"/);
  assert.match(html, /name="cedula"/);
  assert.match(html, /name="usuario"/);
  assert.match(html, /name="clave_actual_perfil"/);
  assert.match(html, /Cuenta actual/);
  assert.match(html, /maria\.prueba/);
  assert.match(html, /Administrador|Docente/);
  assert.match(html, /action="\/cuenta\/clave"/);
});
