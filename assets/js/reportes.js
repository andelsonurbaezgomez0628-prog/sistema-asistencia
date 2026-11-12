/*
 * Reporte general.
 * Los filtros cambian la seleccion de curso y seccion; las exportaciones usan
 * los datos y el rango que la vista recibio del servidor.
 */
const botonExportarReporte = document.querySelector('[data-exportacion-general]');
const filtroCurso = document.querySelector('#curso');
const filtroSeccion = document.querySelector('#seccion');

function prepararFiltroDeSecciones() {
  if (!filtroCurso || !filtroSeccion) return;

  function actualizarSeccionesVisibles() {
    const cursoSeleccionado = filtroCurso.value;
    let seccionSeleccionadaVisible = false;

    for (const opcion of filtroSeccion.options) {
      if (!opcion.value) continue;

      // El curso se agrega al texto cuando no hay filtro para distinguir secciones homonimas.
      const nombreSeccion = opcion.textContent.split(' · ')[0];
      const coincideConCurso = !cursoSeleccionado || opcion.dataset.cursoId === cursoSeleccionado;
      opcion.hidden = !coincideConCurso;
      opcion.disabled = !coincideConCurso;
      opcion.textContent = cursoSeleccionado
        ? nombreSeccion
        : `${nombreSeccion} · ${opcion.dataset.cursoNombre}`;

      if (opcion.value === filtroSeccion.value && coincideConCurso) {
        seccionSeleccionadaVisible = true;
      }
    }

    if (!seccionSeleccionadaVisible) filtroSeccion.value = '';
  }

  filtroCurso.addEventListener('change', actualizarSeccionesVisibles);
  actualizarSeccionesVisibles();
}

function escaparTextoHtml(valor) {
  // Exportaciones HTML se abren en Excel o Word: escapar evita interpretar nombres como etiquetas.
  const reemplazos = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(valor).replace(/[&<>"']/g, (caracter) => reemplazos[caracter]);
}

function crearNombreSeguro(valor) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'reporte-asistencia';
}

function descargarArchivo(contenido, tipo, extension) {
  const desde = botonExportarReporte.dataset.desde;
  const hasta = botonExportarReporte.dataset.hasta;
  const enlace = document.createElement('a');
  const archivo = new Blob([contenido], { type: tipo });
  const direccionTemporal = URL.createObjectURL(archivo);

  enlace.href = direccionTemporal;
  enlace.download = `reporte-asistencia-${desde}-${hasta}.${extension}`;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  // Liberar la direccion temporal evita acumular memoria despues de varias descargas.
  URL.revokeObjectURL(direccionTemporal);
}

function obtenerFilasReporte() {
  const encabezados = [
    'Estudiante', 'Lista', 'Curso', 'Sección', 'Asistencias',
    'Tardanzas', 'Ausencias', 'Justificadas', 'Asistencia (%)',
  ];

  const filasEstudiantes = Array.from(document.querySelectorAll('[data-fila-exportacion]'), (fila) => {
    const datos = fila.dataset;
    return [
      datos.nombre,
      datos.lista,
      datos.curso,
      datos.seccion,
      datos.asistencias,
      datos.tardanzas,
      datos.ausencias,
      datos.justificadas,
      datos.porcentaje,
    ];
  });

  return [encabezados, ...filasEstudiantes];
}

function crearTablaHtml(filas) {
  return filas.map((fila, indiceFila) => {
    // La primera fila son titulos; las demas son datos del reporte.
    const etiquetaCelda = indiceFila === 0 ? 'th' : 'td';
    const celdas = fila.map((valor) => `<${etiquetaCelda}>${escaparTextoHtml(valor)}</${etiquetaCelda}>`);
    return `<tr>${celdas.join('')}</tr>`;
  }).join('');
}

function crearResumenReporte() {
  const desde = botonExportarReporte.dataset.desde;
  const hasta = botonExportarReporte.dataset.hasta;
  const asistencia = botonExportarReporte.dataset.asistenciaGeneral;
  const registros = botonExportarReporte.dataset.totalRegistros;

  return `<p><b>Período:</b> ${desde} a ${hasta}</p>`
    + `<p><b>Asistencia general:</b> ${asistencia}% &nbsp; <b>Registros:</b> ${registros}</p>`;
}

/* Excel y Word abren el mismo resumen y las mismas filas del reporte. */
function descargarExcel() {
  const filas = obtenerFilasReporte();
  const nombre = crearNombreSeguro('reporte-asistencia');
  const tabla = crearTablaHtml(filas);
  const documento = `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><meta name="ProgId" content="Excel.Sheet"><title>${nombre}</title><style>body{font-family:Calibri,Arial,sans-serif;color:#202033}h1{color:#342a58;font-size:20pt}table{border-collapse:collapse;font-size:11pt}th{background:#EDE9FE;color:#342a58}th,td{border:1px solid #C9C5D8;padding:8px 12px;text-align:left}</style></head><body><h1>Reporte de asistencia</h1>${crearResumenReporte()}<table>${tabla}</table></body></html>`;

  descargarArchivo(`\uFEFF${documento}`, 'application/vnd.ms-excel;charset=utf-8', 'xls');
}

function descargarWord() {
  const filas = obtenerFilasReporte();
  const tabla = crearTablaHtml(filas);
  const documento = `<!doctype html><html><head><meta charset="utf-8"><title>Reporte de asistencia</title><style>body{font-family:Arial,sans-serif;color:#202033}h1{color:#342a58}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #bbb;padding:8px;text-align:left}th{background:#eee8ff}</style></head><body><h1>Reporte de asistencia</h1>${crearResumenReporte()}<table>${tabla}</table></body></html>`;

  descargarArchivo(`\uFEFF${documento}`, 'application/msword;charset=utf-8', 'doc');
}

/* El navegador usa el titulo de la pagina como nombre sugerido del PDF. */
function imprimirComoPdf(nombreArchivo) {
  const tituloOriginal = document.title;
  const restaurarTitulo = () => {
    document.title = tituloOriginal;
    window.removeEventListener('afterprint', restaurarTitulo);
  };
  window.addEventListener('afterprint', restaurarTitulo);
  document.title = nombreArchivo;
  window.print();
}

function prepararExportacion() {
  if (!botonExportarReporte) return;

  botonExportarReporte.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-exportar]');
    const formato = boton?.dataset.exportar;

    if (formato === 'pdf') {
      const { desde, hasta } = botonExportarReporte.dataset;
      imprimirComoPdf(`Reporte de asistencia ${desde} al ${hasta}`);
    }
    if (formato === 'excel') descargarExcel();
    if (formato === 'word') descargarWord();
  });
}

prepararFiltroDeSecciones();
prepararExportacion();
