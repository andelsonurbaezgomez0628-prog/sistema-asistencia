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
