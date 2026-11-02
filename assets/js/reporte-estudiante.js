const controlesExportacion = document.querySelector('[data-exportacion-reporte]');

function crearNombreArchivo(valor) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'reporte-estudiante';
}

function descargarArchivo(contenido, tipo, extension) {
  const nombre = crearNombreArchivo(controlesExportacion.dataset.estudiante);
  const enlace = document.createElement('a');
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  enlace.href = url;
  enlace.download = `${nombre}-${controlesExportacion.dataset.desde}-${controlesExportacion.dataset.hasta}.${extension}`;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

function obtenerDatosTabla() {
  const encabezados = Array.from(document.querySelectorAll('.card table thead th'), (celda) => celda.innerText.trim());
  const registros = Array.from(document.querySelectorAll('.card table tbody tr'))
    .map((fila) => {
      const celdas = Array.from(fila.querySelectorAll('td'));
      if (celdas.length !== 3) return null;
      const estado = celdas[1].querySelector('.reporte-estado');
      return [celdas[0].innerText.trim(), estado?.innerText.trim().replace(/^[✓◷!i]\s*/, '') || celdas[1].innerText.trim(), celdas[2].innerText.trim()];
    })
    .filter(Boolean);
  return [encabezados, ...registros];
}

function exportarExcel() {
  const filas = obtenerDatosTabla();
  const nombre = escaparHtml(controlesExportacion.dataset.estudiante);
  const rango = `${controlesExportacion.dataset.desde} a ${controlesExportacion.dataset.hasta}`;
  const encabezados = filas[0].map((celda) => `<th>${escaparHtml(celda)}</th>`).join('');
  const registros = filas.slice(1).map((fila) => {
    const estado = fila[1].toLowerCase();
    const color = { presente: '#D1FAE5', tardanza: '#FEF3C7', ausente: '#FEE2E2', justificado: '#DBEAFE' }[estado] || '#FFFFFF';
    return `<tr><td>${escaparHtml(fila[0])}</td><td style="background:${color};font-weight:bold">${escaparHtml(fila[1])}</td><td>${escaparHtml(fila[2])}</td></tr>`;
  }).join('');
  const documento = `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><meta name="ProgId" content="Excel.Sheet"><title>Asistencia - ${nombre}</title><style>body{font-family:Calibri,Arial,sans-serif;color:#202033}h1{color:#342a58;font-size:20pt}p{color:#555}table{border-collapse:collapse;font-size:11pt}th{background:#EDE9FE;color:#342a58;font-weight:bold}th,td{border:1px solid #C9C5D8;padding:8px 12px}td{vertical-align:top}</style></head><body><h1>Historial de asistencia</h1><p><b>Estudiante:</b> ${nombre}</p><p><b>Período:</b> ${rango}</p><table><thead><tr>${encabezados}</tr></thead><tbody>${registros || '<tr><td colspan="3">No hay registros para este período.</td></tr>'}</tbody></table></body></html>`;
  descargarArchivo(`\uFEFF${documento}`, 'application/vnd.ms-excel;charset=utf-8', 'xls');
}

function escaparHtml(valor) {
  return valor.replace(/[&<>"']/g, (caracter) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caracter]);
}

function exportarWord() {
  const filas = obtenerDatosTabla();
  const tabla = filas.map((fila, indice) => `<tr>${fila.map((celda) => `<${indice === 0 ? 'th' : 'td'}>${escaparHtml(celda)}</${indice === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('');
  const nombre = escaparHtml(controlesExportacion.dataset.estudiante);
  const rango = `${controlesExportacion.dataset.desde} a ${controlesExportacion.dataset.hasta}`;
  const documento = `<!doctype html><html><head><meta charset="utf-8"><title>Asistencia - ${nombre}</title><style>body{font-family:Arial,sans-serif;color:#202033}h1{color:#342a58}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #bbb;padding:9px;text-align:left}th{background:#eee8ff}</style></head><body><h1>Historial de asistencia</h1><h2>${nombre}</h2><p>Período: ${rango}</p><table>${tabla}</table></body></html>`;
  descargarArchivo(`\uFEFF${documento}`, 'application/msword;charset=utf-8', 'doc');
}

if (controlesExportacion) {
  controlesExportacion.addEventListener('click', (evento) => {
    const accion = evento.target.closest('[data-exportar]')?.dataset.exportar;
    if (accion === 'pdf') window.print();
    if (accion === 'excel') exportarExcel();
    if (accion === 'word') exportarWord();
  });
}
