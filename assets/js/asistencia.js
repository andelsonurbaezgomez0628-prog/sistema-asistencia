const botonMarcarPresentes = document.querySelector('[data-marcar-todos-presentes]');
const estadosAsistencia = Array.from(document.querySelectorAll('[data-estado-asistencia]'));
const avisoMarcarPresentes = document.querySelector('[data-aviso-marcar-presentes]');

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
