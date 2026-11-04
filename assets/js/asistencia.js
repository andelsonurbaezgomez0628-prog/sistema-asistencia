/*
 * Interfaz del pase de lista.
 * Los selectores actualizan su apariencia y los contadores; el formulario HTML
 * envia las marcas al servidor cuando el docente guarda la lista.
 */
const botonMarcarPresentes = document.querySelector('[data-marcar-todos-presentes]');
const selectoresAsistencia = Array.from(document.querySelectorAll('[data-estado-asistencia]'));
const avisoMarcarPresentes = document.querySelector('[data-aviso-marcar-presentes]');
const contadoresEstado = Array.from(document.querySelectorAll('[data-conteo-estado]'));

const iconoPorEstado = {
  presente: '✓',
  tardanza: '◷',
  ausente: '!',
  justificado: 'i',
};

const estadosPermitidos = Object.keys(iconoPorEstado);

/* Apariencia de una marca individual */
// Sincroniza el color y el icono con el estado que se enviara al servidor.
// La clase se aplica al select y a su contenedor para que ambos cambien juntos.
function actualizarPresentacionEstado(selector) {
  const estadoActual = selector.value;
  const contenedor = selector.closest('.estado-selector');

  for (const estado of estadosPermitidos) {
    selector.classList.toggle(`estado-${estado}`, estadoActual === estado);
    if (contenedor) contenedor.classList.toggle(`estado-${estado}`, estadoActual === estado);
  }

  const icono = contenedor?.querySelector('[data-icono-estado]');
  if (icono) icono.textContent = iconoPorEstado[estadoActual] || '';
}

// Cuenta cuantas veces aparece cada uno de los cuatro estados posibles.
function contarEstadosSeleccionados() {
  // Ignorar valores vacios o alterados evita que el resumen cuente estados desconocidos.
  const cantidades = { presente: 0, tardanza: 0, ausente: 0, justificado: 0 };

  for (const selector of selectoresAsistencia) {
    if (Object.hasOwn(cantidades, selector.value)) {
      cantidades[selector.value] += 1;
    }
  }

  return cantidades;
}

function actualizarContadores() {
  const cantidades = contarEstadosSeleccionados();

  for (const contador of contadoresEstado) {
    contador.textContent = cantidades[contador.dataset.conteoEstado];
  }
}

/* Cambios hechos por el docente */
function actualizarFilaAsistencia(selector) {
  actualizarPresentacionEstado(selector);
  actualizarContadores();
}

for (const selector of selectoresAsistencia) {
  actualizarPresentacionEstado(selector);
  selector.addEventListener('change', () => actualizarFilaAsistencia(selector));
}

actualizarContadores();

if (botonMarcarPresentes) {
  botonMarcarPresentes.addEventListener('click', () => {
    for (const selector of selectoresAsistencia) {
      selector.value = 'presente';
      selector.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (avisoMarcarPresentes) {
      avisoMarcarPresentes.textContent = `Se marcaron ${selectoresAsistencia.length} estudiantes como presentes. Revisa y guarda la lista.`;
    }
  });
}
