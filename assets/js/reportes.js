const exportacionGeneral = document.querySelector('[data-exportacion-general]');
const filtroCurso = document.querySelector('#curso');
const filtroSeccion = document.querySelector('#seccion');

function filtrarSeccionesPorCurso() {
  if (!filtroCurso || !filtroSeccion) return;
  const cursoSeleccionado = filtroCurso.value;
  let seccionSeleccionadaVisible = false;
  for (const opcion of filtroSeccion.options) {
    if (!opcion.value) continue;
    const coincide = !cursoSeleccionado || opcion.dataset.cursoId === cursoSeleccionado;
    opcion.hidden = !coincide;
    opcion.disabled = !coincide;
    opcion.textContent = cursoSeleccionado ? opcion.textContent.split(' · ')[0] : `${opcion.textContent.split(' · ')[0]} · ${opcion.dataset.cursoNombre}`;
    if (opcion.value === filtroSeccion.value && coincide) seccionSeleccionadaVisible = true;
  }
  if (!seccionSeleccionadaVisible) filtroSeccion.value = '';
}

if (filtroCurso && filtroSeccion) {
  filtroCurso.addEventListener('change', filtrarSeccionesPorCurso);
  filtrarSeccionesPorCurso();
}

function escaparTextoHtml(valor) {
  return String(valor).replace(/[&<>"']/g, (caracter) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caracter]);
}

function nombreSeguro(valor) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'reporte-asistencia';
}

function guardarArchivo(contenido, tipo, extension) {
  const archivo = document.createElement('a');
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  archivo.href = url;
  archivo.download = `reporte-asistencia-${exportacionGeneral.dataset.desde}-${exportacionGeneral.dataset.hasta}.${extension}`;
  document.body.append(archivo);
  archivo.click();
  archivo.remove();
  URL.revokeObjectURL(url);
}

function obtenerFilasReporte() {
  const encabezados = ['Estudiante', 'Lista', 'Curso', 'Sección', 'Asistencias', 'Tardanzas', 'Ausencias', 'Justificadas', 'Asistencia (%)'];
  const estudiantes = Array.from(document.querySelectorAll('[data-fila-exportacion]'), (fila) => {
    const datos = fila.dataset;
    return [datos.nombre, datos.lista, datos.curso, datos.seccion, datos.asistencias,
      datos.tardanzas, datos.ausencias, datos.justificadas, datos.porcentaje];
  });
  return [encabezados, ...estudiantes];
}

function htmlTabla(filas) {
  return filas.map((fila, indice) => `<tr>${fila.map((valor) => `<${indice === 0 ? 'th' : 'td'}>${escaparTextoHtml(valor)}</${indice === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('');
}

function descargarExcel() {
  const filas = obtenerFilasReporte();
  const nombre = nombreSeguro('reporte-asistencia');
  const rango = `${exportacionGeneral.dataset.desde} a ${exportacionGeneral.dataset.hasta}`;
  const resumen = `<p><b>Período:</b> ${rango}</p><p><b>Asistencia general:</b> ${exportacionGeneral.dataset.asistenciaGeneral}% &nbsp; <b>Registros:</b> ${exportacionGeneral.dataset.totalRegistros}</p>`;
  const documento = `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><meta name="ProgId" content="Excel.Sheet"><title>${nombre}</title><style>body{font-family:Calibri,Arial,sans-serif;color:#202033}h1{color:#342a58;font-size:20pt}table{border-collapse:collapse;font-size:11pt}th{background:#EDE9FE;color:#342a58}th,td{border:1px solid #C9C5D8;padding:8px 12px;text-align:left}</style></head><body><h1>Reporte de asistencia</h1>${resumen}<table>${htmlTabla(filas)}</table></body></html>`;
  guardarArchivo(`\uFEFF${documento}`, 'application/vnd.ms-excel;charset=utf-8', 'xls');
}

function descargarWord() {
  const filas = obtenerFilasReporte();
  const rango = `${exportacionGeneral.dataset.desde} a ${exportacionGeneral.dataset.hasta}`;
  const documento = `<!doctype html><html><head><meta charset="utf-8"><title>Reporte de asistencia</title><style>body{font-family:Arial,sans-serif;color:#202033}h1{color:#342a58}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #bbb;padding:8px;text-align:left}th{background:#eee8ff}</style></head><body><h1>Reporte de asistencia</h1><p><b>Período:</b> ${rango}</p><p><b>Asistencia general:</b> ${exportacionGeneral.dataset.asistenciaGeneral}%</p><p><b>Total de registros:</b> ${exportacionGeneral.dataset.totalRegistros}</p><table>${htmlTabla(filas)}</table></body></html>`;
  guardarArchivo(`\uFEFF${documento}`, 'application/msword;charset=utf-8', 'doc');
}

if (exportacionGeneral) {
  exportacionGeneral.addEventListener('click', (evento) => {
    const accion = evento.target.closest('[data-exportar]')?.dataset.exportar;
    if (accion === 'pdf') window.print();
    if (accion === 'excel') descargarExcel();
    if (accion === 'word') descargarWord();
  });
}
