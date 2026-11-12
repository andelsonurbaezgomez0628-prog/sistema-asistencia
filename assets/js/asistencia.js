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

// La lista completa esta en presente cuando todos los selectores tienen ese valor.
function todaLaListaEstaPresente() {
  return selectoresAsistencia.length > 0
    && selectoresAsistencia.every((selector) => selector.value === 'presente');
}

/*
 * El mismo boton cumple dos funciones:
 * - Si la lista no esta completa, marca a todos presentes.
 * - Si todos ya estan presentes, los desmarca para corregir la lista.
 * El atributo aria-pressed informa el estado y activa el color rojo en CSS.
 */
function actualizarBotonMasivo() {
  if (!botonMarcarPresentes) return;

  const desmarcar = todaLaListaEstaPresente();
  botonMarcarPresentes.setAttribute('aria-pressed', String(desmarcar));
  const texto = botonMarcarPresentes.querySelector('[data-texto-masivo]');
  if (texto) texto.textContent = desmarcar ? 'Desmarcar todos' : 'Marcar todos presentes';
}

/* Cambios hechos por el docente */
function actualizarFilaAsistencia(selector) {
  actualizarPresentacionEstado(selector);
  actualizarContadores();
  actualizarBotonMasivo();
}

for (const selector of selectoresAsistencia) {
  actualizarPresentacionEstado(selector);
  selector.addEventListener('change', () => actualizarFilaAsistencia(selector));
}

actualizarContadores();
actualizarBotonMasivo();

if (botonMarcarPresentes) {
  botonMarcarPresentes.addEventListener('click', () => {
    const desmarcar = todaLaListaEstaPresente();
    const nuevoValor = desmarcar ? '' : 'presente';

    for (const selector of selectoresAsistencia) {
      selector.value = nuevoValor;
      selector.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // El evento change ya actualiza el boton; se repite por si no hubo selectores.
    actualizarBotonMasivo();

    if (avisoMarcarPresentes) {
      avisoMarcarPresentes.textContent = desmarcar
        ? `Se desmarcaron ${selectoresAsistencia.length} estudiantes. Elige el estado de cada uno.`
        : `Se marcaron ${selectoresAsistencia.length} estudiantes como presentes. Revisa y guarda la lista.`;
    }
  });
}
