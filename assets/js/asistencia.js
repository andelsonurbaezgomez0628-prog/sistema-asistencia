const botonMarcarPresentes = document.querySelector('[data-marcar-todos-presentes]');
const estadosAsistencia = Array.from(document.querySelectorAll('[data-estado-asistencia]'));
const avisoMarcarPresentes = document.querySelector('[data-aviso-marcar-presentes]');
const iconosEstado = { presente: '✓', tardanza: '◷', ausente: '!', justificado: 'i' };
const contadoresEstado = Array.from(document.querySelectorAll('[data-conteo-estado]'));

function actualizarColorEstado(select) {
  for (const estado of ['presente', 'ausente', 'justificado', 'tardanza']) {
    select.classList.toggle(`estado-${estado}`, select.value === estado);
  }

  const selector = select.closest('.estado-selector');
  if (selector) {
    for (const estado of Object.keys(iconosEstado)) {
      selector.classList.toggle(`estado-${estado}`, select.value === estado);
    }

    const icono = selector.querySelector('[data-icono-estado]');
    if (icono) icono.textContent = iconosEstado[select.value] || '';
  }
}

function actualizarContadores() {
  const totales = { presente: 0, tardanza: 0, ausente: 0, justificado: 0 };
  for (const select of estadosAsistencia) {
    if (Object.hasOwn(totales, select.value)) totales[select.value] += 1;
  }

  for (const contador of contadoresEstado) {
    contador.textContent = totales[contador.dataset.conteoEstado];
  }
}

for (const estado of estadosAsistencia) {
  actualizarColorEstado(estado);
  estado.addEventListener('change', () => {
    actualizarColorEstado(estado);
    actualizarContadores();
  });
}
actualizarContadores();

if (botonMarcarPresentes) {
  botonMarcarPresentes.addEventListener('click', () => {
    for (const estado of estadosAsistencia) {
      estado.value = 'presente';
      estado.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (avisoMarcarPresentes) {
      avisoMarcarPresentes.textContent = `Se marcaron ${estadosAsistencia.length} estudiantes como presentes. Revisa y guarda la lista.`;
    }
  });
}
