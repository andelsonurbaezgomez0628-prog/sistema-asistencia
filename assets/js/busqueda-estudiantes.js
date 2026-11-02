function textoBuscable(valor) {
  return valor.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

document.querySelectorAll('[data-busqueda-inteligente]').forEach((buscador) => {
  const selector = buscador.dataset.busquedaInteligente;
  const elementos = Array.from(document.querySelectorAll(`${selector} [data-elemento-buscable]`));
  const avisoVacio = document.querySelector(buscador.dataset.avisoVacio || '');
  const avisoResultados = document.querySelector(buscador.dataset.avisoResultados || '');

  function buscar() {
    const terminos = textoBuscable(buscador.value).split(/\s+/).filter(Boolean);
    let cantidad = 0;
    for (const elemento of elementos) {
      const texto = textoBuscable(elemento.dataset.textoBusqueda || elemento.textContent);
      const coincide = terminos.every((termino) => texto.includes(termino));
      elemento.hidden = !coincide;
      if (coincide) cantidad += 1;
    }
    if (avisoVacio) avisoVacio.hidden = terminos.length === 0 || cantidad > 0;
    if (avisoResultados) avisoResultados.textContent = terminos.length ? `${cantidad} resultado(s)` : '';
  }

  buscador.addEventListener('input', buscar);
});

const buscadorGlobal = document.querySelector('[data-busqueda-global]');
const toggleBuscadorGlobal = document.querySelector('[data-busqueda-global-toggle]');
const campoBuscadorGlobal = document.querySelector('[data-busqueda-global-campo]');
const avisoBuscadorGlobal = document.querySelector('[data-busqueda-global-vacio]');
const resultadosBuscadorGlobal = document.querySelector('[data-busqueda-global-resultados]');
const elementosGlobales = Array.from(document.querySelectorAll('[data-elemento-buscable]'));

if (buscadorGlobal && toggleBuscadorGlobal && campoBuscadorGlobal) {
  document.querySelector('[data-busqueda-global-form]')?.addEventListener('submit', (evento) => {
    evento.preventDefault();
    if (!buscadorGlobal.value.trim()) return;
    const primero = elementosGlobales.find((elemento) => !elemento.hidden);
    if (!primero) return;
    primero.scrollIntoView({ behavior: 'smooth', block: 'center' });
    primero.classList.add('busqueda-resaltada');
    window.setTimeout(() => primero.classList.remove('busqueda-resaltada'), 1400);
  });
  toggleBuscadorGlobal.addEventListener('click', () => {
    const abierto = toggleBuscadorGlobal.getAttribute('aria-expanded') === 'true';
    toggleBuscadorGlobal.setAttribute('aria-expanded', String(!abierto));
    toggleBuscadorGlobal.setAttribute('aria-label', abierto ? 'Abrir búsqueda de estudiantes' : 'Cerrar búsqueda de estudiantes');
    campoBuscadorGlobal.classList.toggle('is-open', !abierto);
    campoBuscadorGlobal.setAttribute('aria-hidden', String(abierto));
    if (!abierto) buscadorGlobal.focus();
    else {
      buscadorGlobal.value = '';
      buscadorGlobal.dispatchEvent(new Event('input'));
    }
  });

  buscadorGlobal.addEventListener('input', () => {
    const terminos = textoBuscable(buscadorGlobal.value).split(/\s+/).filter(Boolean);
    let cantidad = 0;
    for (const elemento of elementosGlobales) {
      const texto = textoBuscable(elemento.dataset.textoBusqueda || elemento.textContent);
      const coincide = terminos.every((termino) => texto.includes(termino));
      elemento.hidden = !coincide;
      if (coincide) cantidad += 1;
    }
    if (avisoBuscadorGlobal) avisoBuscadorGlobal.hidden = terminos.length === 0 || cantidad > 0;
    if (resultadosBuscadorGlobal) resultadosBuscadorGlobal.textContent = terminos.length ? `${cantidad} resultado(s)` : '';
  });
}
