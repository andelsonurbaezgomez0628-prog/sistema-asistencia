/*
 * Exportacion del historial individual.
 * Las filas se leen de la tabla ya filtrada por el servidor y se convierten
 * a documentos HTML que Excel y Word pueden abrir.
 */
const controlesExportacion = document.querySelector('[data-exportacion-reporte]');

function crearNombreArchivo(valor) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'reporte-estudiante';
}

function escaparTextoHtml(valor) {
  const reemplazos = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(valor).replace(/[&<>"']/g, (caracter) => reemplazos[caracter]);
}

function descargarArchivo(contenido, tipo, extension) {
  const estudiante = crearNombreArchivo(controlesExportacion.dataset.estudiante);
  const desde = controlesExportacion.dataset.desde;
  const hasta = controlesExportacion.dataset.hasta;
  const enlace = document.createElement('a');
  const archivo = new Blob([contenido], { type: tipo });
  const direccionTemporal = URL.createObjectURL(archivo);

  enlace.href = direccionTemporal;
  enlace.download = `${estudiante}-${desde}-${hasta}.${extension}`;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(direccionTemporal);
}

function leerFilasDelHistorial() {
  const encabezados = Array.from(
    document.querySelectorAll('.card table thead th'),
    (celda) => celda.innerText.trim(),
  );
  const filas = Array.from(document.querySelectorAll('.card table tbody tr'));
  const registros = [];

  for (const fila of filas) {
    const celdas = Array.from(fila.querySelectorAll('td'));
    // La fila vacia informativa no tiene tres celdas de datos y no debe exportarse.
    if (celdas.length !== 3) continue;

    const estado = celdas[1].querySelector('.reporte-estado');
    const textoEstado = estado?.innerText.trim().replace(/^[✓◷!i]\s*/, '')
      || celdas[1].innerText.trim();

    registros.push([
      celdas[0].innerText.trim(),
      textoEstado,
      celdas[2].innerText.trim(),
    ]);
  }

  return [encabezados, ...registros];
}

/* La tabla HTML conserva encabezados y escapa los valores del estudiante. */
function crearTablaHtml(filas) {
  return filas.map((fila, indiceFila) => {
    const etiquetaCelda = indiceFila === 0 ? 'th' : 'td';
    const celdas = fila.map((valor) => (
      `<${etiquetaCelda}>${escaparTextoHtml(valor)}</${etiquetaCelda}>`
    ));
    return `<tr>${celdas.join('')}</tr>`;
  }).join('');
}

/* Excel muestra colores por estado; Word usa una tabla simple para imprimir. */
function colorDeEstado(estado) {
  // Mantener los mismos colores del formulario hace mas facil reconocer cada marca exportada.
  const colores = {
    presente: '#D1FAE5',
    tardanza: '#FEF3C7',
    ausente: '#FEE2E2',
    justificado: '#DBEAFE',
  };
  return colores[estado.toLowerCase()] || '#FFFFFF';
}

function crearFilasDeExcel(filas) {
  const encabezados = filas[0].map((celda) => `<th>${escaparTextoHtml(celda)}</th>`).join('');
  const registros = filas.slice(1).map((fila) => {
    const colorEstado = colorDeEstado(fila[1]);
    const nombre = escaparTextoHtml(fila[0]);
    const estado = escaparTextoHtml(fila[1]);
    const fecha = escaparTextoHtml(fila[2]);

    return `<tr><td>${nombre}</td><td style="background:${colorEstado};font-weight:bold">${estado}</td><td>${fecha}</td></tr>`;
  }).join('');

  // Excel debe mostrar una fila legible aunque el periodo no tenga registros.
  const filasVacias = registros || '<tr><td colspan="3">No hay registros para este período.</td></tr>';
  return `<thead><tr>${encabezados}</tr></thead><tbody>${filasVacias}</tbody>`;
}

function exportarExcel() {
  const filas = leerFilasDelHistorial();
  const nombre = escaparTextoHtml(controlesExportacion.dataset.estudiante);
  const desde = controlesExportacion.dataset.desde;
  const hasta = controlesExportacion.dataset.hasta;
  const tabla = crearFilasDeExcel(filas);
  const documento = `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><meta name="ProgId" content="Excel.Sheet"><title>Asistencia - ${nombre}</title><style>body{font-family:Calibri,Arial,sans-serif;color:#202033}h1{color:#342a58;font-size:20pt}p{color:#555}table{border-collapse:collapse;font-size:11pt}th{background:#EDE9FE;color:#342a58;font-weight:bold}th,td{border:1px solid #C9C5D8;padding:8px 12px}td{vertical-align:top}</style></head><body><h1>Historial de asistencia</h1><p><b>Estudiante:</b> ${nombre}</p><p><b>Período:</b> ${desde} a ${hasta}</p><table>${tabla}</table></body></html>`;

  descargarArchivo(`\uFEFF${documento}`, 'application/vnd.ms-excel;charset=utf-8', 'xls');
}

function exportarWord() {
  const filas = leerFilasDelHistorial();
  const tabla = crearTablaHtml(filas);
  const nombre = escaparTextoHtml(controlesExportacion.dataset.estudiante);
  const desde = controlesExportacion.dataset.desde;
  const hasta = controlesExportacion.dataset.hasta;
  const documento = `<!doctype html><html><head><meta charset="utf-8"><title>Asistencia - ${nombre}</title><style>body{font-family:Arial,sans-serif;color:#202033}h1{color:#342a58}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #bbb;padding:9px;text-align:left}th{background:#eee8ff}</style></head><body><h1>Historial de asistencia</h1><h2>${nombre}</h2><p>Período: ${desde} a ${hasta}</p><table>${tabla}</table></body></html>`;

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
  if (!controlesExportacion) return;

  controlesExportacion.addEventListener('click', (evento) => {
    const formato = evento.target.closest('[data-exportar]')?.dataset.exportar;
    if (formato === 'pdf') {
      const { estudiante, desde, hasta } = controlesExportacion.dataset;
      imprimirComoPdf(`Asistencia - ${estudiante} - ${desde} al ${hasta}`);
    }
    if (formato === 'excel') exportarExcel();
    if (formato === 'word') exportarWord();
  });
}

prepararExportacion();
