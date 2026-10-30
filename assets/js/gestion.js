// Pestanas y filtros de la pagina de gestion academica.
const CLAVE_PESTANA = 'gestion-pestana-activa';
const botonesPestana = Array.from(document.querySelectorAll('[data-gestion-tab]'));
const selectorDocentes = document.querySelector('.gestion-docentes-dropdown');

if (selectorDocentes) {
  const resumenDocentes = selectorDocentes.querySelector('[data-docentes-resumen]');
  const casillasDocentes = Array.from(selectorDocentes.querySelectorAll('input[name="docente_ids"]'));

  function actualizarResumenDocentes() {
    const cantidad = casillasDocentes.filter((casilla) => casilla.checked).length;
    if (!resumenDocentes) return;
    resumenDocentes.textContent = cantidad === 0
      ? 'Seleccionar docentes'
      : `${cantidad} docente${cantidad === 1 ? '' : 's'} seleccionado${cantidad === 1 ? '' : 's'}`;
  }

  casillasDocentes.forEach((casilla) => casilla.addEventListener('change', actualizarResumenDocentes));
  actualizarResumenDocentes();
}

if (botonesPestana.length > 0) {
  // La clase permite ocultar paneles solo cuando JavaScript esta disponible.
  document.documentElement.classList.add('gestion-js');

  const paneles = botonesPestana.map((boton) => document.getElementById(boton.getAttribute('aria-controls')));
  const claves = botonesPestana.map((boton) => boton.dataset.gestionTab);

  function activarPestana(indice, guardar) {
    botonesPestana.forEach((boton, posicion) => {
      const activo = posicion === indice;
      boton.classList.toggle('is-active', activo);
      boton.setAttribute('aria-selected', String(activo));
      boton.tabIndex = activo ? 0 : -1;

      const panel = paneles[posicion];
      if (panel) {
        panel.classList.toggle('is-active', activo);
        panel.hidden = !activo;
      }
    });

    if (guardar && claves[indice]) {
      try {
        window.sessionStorage.setItem(CLAVE_PESTANA, claves[indice]);
      } catch (error) {
        // El almacenamiento puede estar bloqueado; la pagina sigue funcionando.
      }
    }
  }

  let pestanaGuardada = null;
  try {
    pestanaGuardada = window.sessionStorage.getItem(CLAVE_PESTANA);
  } catch (error) {
    pestanaGuardada = null;
  }

  const indiceGuardado = claves.indexOf(pestanaGuardada);
  activarPestana(indiceGuardado >= 0 ? indiceGuardado : 0, false);

  botonesPestana.forEach((boton, indice) => {
    boton.addEventListener('click', () => activarPestana(indice, true));

    boton.addEventListener('keydown', (evento) => {
      let destino = null;
      if (evento.key === 'ArrowRight') destino = (indice + 1) % botonesPestana.length;
      else if (evento.key === 'ArrowLeft') destino = (indice - 1 + botonesPestana.length) % botonesPestana.length;
      else if (evento.key === 'Home') destino = 0;
      else if (evento.key === 'End') destino = botonesPestana.length - 1;
      if (destino === null) return;

      evento.preventDefault();
      activarPestana(destino, true);
      botonesPestana[destino].focus();
    });
  });
}

function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

document.querySelectorAll('[data-filtrar-tabla]').forEach((entrada) => {
  const tabla = document.getElementById(entrada.getAttribute('data-filtrar-tabla'));
  if (!tabla) return;

  const filas = Array.from(tabla.querySelectorAll('tbody tr')).filter((fila) => !fila.hasAttribute('data-filtro-vacio'));
  const mensajeVacio = tabla.querySelector('[data-filtro-vacio]');

  function filtrarFilas() {
    const busqueda = normalizarTexto(entrada.value.trim());
    let visibles = 0;

    filas.forEach((fila) => {
      const coincide = busqueda === '' || normalizarTexto(fila.textContent).includes(busqueda);
      fila.hidden = !coincide;
      if (coincide) visibles += 1;
    });

    if (mensajeVacio) mensajeVacio.hidden = busqueda === '' || visibles > 0;
  }

  entrada.addEventListener('input', filtrarFilas);
});

document.querySelectorAll('form[data-confirmar]').forEach((formulario) => {
  formulario.addEventListener('submit', (evento) => {
    if (!window.confirm(formulario.getAttribute('data-confirmar'))) {
      evento.preventDefault();
    }
  });
});
