const botonMarcarPresentes = document.querySelector('[data-marcar-todos-presentes]');
const estadosAsistencia = Array.from(document.querySelectorAll('[data-estado-asistencia]'));
const avisoMarcarPresentes = document.querySelector('[data-aviso-marcar-presentes]');

function actualizarColorEstado(select) {
  for (const estado of ['presente', 'ausente', 'justificado', 'tardanza']) {
    select.classList.toggle(`estado-${estado}`, select.value === estado);
  }
}

for (const estado of estadosAsistencia) {
  actualizarColorEstado(estado);
  estado.addEventListener('change', () => actualizarColorEstado(estado));
}

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
