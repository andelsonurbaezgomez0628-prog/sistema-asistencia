/*
 * Funciones compartidas por las busquedas de listas y la busqueda global.
 * Normalizar el texto hace que las tildes no impidan encontrar un nombre.
 */
function normalizarTextoBuscable(texto) {
  // Separar las tildes de las letras permite buscar "Maria" y encontrar "María".
  return texto.toLocaleLowerCase('es').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').trim();
}

function obtenerTerminosDeBusqueda(texto) {
  return normalizarTextoBuscable(texto).split(/\s+/).filter(Boolean);
}

function coincideConBusqueda(elemento, terminos) {
  const texto = elemento.dataset.textoBusqueda || elemento.textContent;
  const textoNormalizado = normalizarTextoBuscable(texto);
  // Cada palabra escrita debe aparecer, aunque las palabras esten en columnas distintas.
  return terminos.every((termino) => textoNormalizado.includes(termino));
}

function mostrarResultados(elementos, terminos, avisoVacio, avisoCantidad) {
  let cantidadVisible = 0;

  for (const elemento of elementos) {
    const coincide = coincideConBusqueda(elemento, terminos);
    elemento.hidden = !coincide;
    if (coincide) cantidadVisible += 1;
  }

  if (avisoVacio) avisoVacio.hidden = terminos.length === 0 || cantidadVisible > 0;
  if (avisoCantidad) {
    avisoCantidad.textContent = terminos.length ? `${cantidadVisible} resultado(s)` : '';
  }

  return cantidadVisible;
}

/* Busqueda local: cada pagina indica que elementos debe filtrar. */
function prepararBusquedasDeLista() {
  document.querySelectorAll('[data-busqueda-inteligente]').forEach((buscador) => {
    const selector = buscador.dataset.busquedaInteligente;
    const elementos = Array.from(document.querySelectorAll(`${selector} [data-elemento-buscable]`));
    const avisoVacio = document.querySelector(buscador.dataset.avisoVacio || '');
    const avisoCantidad = document.querySelector(buscador.dataset.avisoResultados || '');

    buscador.addEventListener('input', () => {
      const terminos = obtenerTerminosDeBusqueda(buscador.value);
      mostrarResultados(elementos, terminos, avisoVacio, avisoCantidad);
    });
  });
}

/* Busqueda global: filtra tarjetas y permite saltar al primer resultado. */
function prepararBusquedaGlobal() {
  const buscador = document.querySelector('[data-busqueda-global]');
  const botonAbrir = document.querySelector('[data-busqueda-global-toggle]');
  const panelBuscador = document.querySelector('[data-busqueda-global-campo]');
  const avisoVacio = document.querySelector('[data-busqueda-global-vacio]');
  const avisoCantidad = document.querySelector('[data-busqueda-global-resultados]');
  const elementos = Array.from(document.querySelectorAll('[data-elemento-buscable]'));

  if (!buscador || !botonAbrir || !panelBuscador) return;

  function actualizarResultados() {
    const terminos = obtenerTerminosDeBusqueda(buscador.value);
    mostrarResultados(elementos, terminos, avisoVacio, avisoCantidad);
  }

  function alternarPanel() {
    const estaAbierto = botonAbrir.getAttribute('aria-expanded') === 'true';
    const nuevoEstado = !estaAbierto;

    botonAbrir.setAttribute('aria-expanded', String(nuevoEstado));
    botonAbrir.setAttribute('aria-label', nuevoEstado
      ? 'Cerrar búsqueda de estudiantes'
      : 'Abrir búsqueda de estudiantes');
    panelBuscador.classList.toggle('is-open', nuevoEstado);
    panelBuscador.setAttribute('aria-hidden', String(!nuevoEstado));

    if (nuevoEstado) {
      buscador.focus();
      return;
    }

    buscador.value = '';
    actualizarResultados();
  }

  function enfocarPrimerResultado(evento) {
    evento.preventDefault();
    if (!buscador.value.trim()) return;

    // El filtro ya escondio los que no coinciden; el primer resultado visible es el mejor destino.
    const primerResultado = elementos.find((elemento) => !elemento.hidden);
    if (!primerResultado) return;

    primerResultado.scrollIntoView({ behavior: 'smooth', block: 'center' });
    primerResultado.classList.add('busqueda-resaltada');
    window.setTimeout(() => primerResultado.classList.remove('busqueda-resaltada'), 1400);
  }

  document.querySelector('[data-busqueda-global-form]')
    ?.addEventListener('submit', enfocarPrimerResultado);
  botonAbrir.addEventListener('click', alternarPanel);
  buscador.addEventListener('input', actualizarResultados);
}

prepararBusquedasDeLista();
prepararBusquedaGlobal();
