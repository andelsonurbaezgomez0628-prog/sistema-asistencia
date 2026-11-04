/*
 * Interacciones de la pagina de coordinacion.
 * Este archivo solo mejora la navegacion de las vistas; los permisos y cambios
 * de cursos, secciones y cuentas se validan en las rutas del servidor.
 */
const CLAVE_PESTANA_ACTIVA = 'gestion-pestana-activa';
const botonesPestana = Array.from(document.querySelectorAll('[data-gestion-tab]'));

function prepararResumenDocentes() {
  const selectorDocentes = document.querySelector('.gestion-docentes-dropdown');
  if (!selectorDocentes) return;

  const resumen = selectorDocentes.querySelector('[data-docentes-resumen]');
  const casillas = Array.from(selectorDocentes.querySelectorAll('input[name="docente_ids"]'));
  if (!resumen) return;

  function actualizarResumen() {
    const cantidad = casillas.filter((casilla) => casilla.checked).length;
    if (cantidad === 0) {
      resumen.textContent = 'Seleccionar docentes';
      return;
    }

    const palabraDocente = cantidad === 1 ? 'docente' : 'docentes';
    const palabraSeleccionado = cantidad === 1 ? 'seleccionado' : 'seleccionados';
    resumen.textContent = `${cantidad} ${palabraDocente} ${palabraSeleccionado}`;
  }

  for (const casilla of casillas) {
    casilla.addEventListener('change', actualizarResumen);
  }
  actualizarResumen();
}

function guardarPestanaActiva(clave) {
  try {
    window.sessionStorage.setItem(CLAVE_PESTANA_ACTIVA, clave);
  } catch (error) {
    // La pagina sigue funcionando aunque el navegador bloquee el almacenamiento.
  }
}

function leerPestanaGuardada() {
  try {
    return window.sessionStorage.getItem(CLAVE_PESTANA_ACTIVA);
  } catch (error) {
    return null;
  }
}

/* Pestanas: mantener panel, boton seleccionado y navegacion por teclado alineados. */
function prepararPestanasGestion() {
  if (botonesPestana.length === 0) return;

  // La clase oculta los paneles secundarios solo cuando JavaScript esta disponible.
  document.documentElement.classList.add('gestion-js');
  const paneles = botonesPestana.map((boton) => document.getElementById(boton.getAttribute('aria-controls')));
  const claves = botonesPestana.map((boton) => boton.dataset.gestionTab);

  function mostrarPestana(indice, guardarSeleccion) {
    // Boton y panel comparten el mismo indice para mantener sincronizados estado y accesibilidad.
    botonesPestana.forEach((boton, posicion) => {
      const estaActiva = posicion === indice;
      boton.classList.toggle('is-active', estaActiva);
      boton.setAttribute('aria-selected', String(estaActiva));
      boton.tabIndex = estaActiva ? 0 : -1;

      const panel = paneles[posicion];
      if (panel) {
        panel.classList.toggle('is-active', estaActiva);
        panel.hidden = !estaActiva;
      }
    });

    if (guardarSeleccion && claves[indice]) {
      guardarPestanaActiva(claves[indice]);
    }
  }

  function buscarIndicePestanaGuardada() {
    return claves.indexOf(leerPestanaGuardada());
  }

  function moverFocoConTeclado(evento, indiceActual) {
    let indiceDestino = null;

    if (evento.key === 'ArrowRight') indiceDestino = (indiceActual + 1) % botonesPestana.length;
    if (evento.key === 'ArrowLeft') indiceDestino = (indiceActual - 1 + botonesPestana.length) % botonesPestana.length;
    if (evento.key === 'Home') indiceDestino = 0;
    if (evento.key === 'End') indiceDestino = botonesPestana.length - 1;
    if (indiceDestino === null) return;

    evento.preventDefault();
    mostrarPestana(indiceDestino, true);
    botonesPestana[indiceDestino].focus();
  }

  const indiceGuardado = buscarIndicePestanaGuardada();
  mostrarPestana(indiceGuardado >= 0 ? indiceGuardado : 0, false);

  botonesPestana.forEach((boton, indice) => {
    boton.addEventListener('click', () => mostrarPestana(indice, true));
    boton.addEventListener('keydown', (evento) => moverFocoConTeclado(evento, indice));
  });
}

function normalizarTexto(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/* Tablas: ocultar filas que no contienen todos los terminos buscados. */
function prepararFiltrosDeTablas() {
  document.querySelectorAll('[data-filtrar-tabla]').forEach((entrada) => {
    const tabla = document.getElementById(entrada.getAttribute('data-filtrar-tabla'));
    if (!tabla) return;

    const filas = Array.from(tabla.querySelectorAll('tbody tr'))
      .filter((fila) => !fila.hasAttribute('data-filtro-vacio'));
    const mensajeVacio = tabla.querySelector('[data-filtro-vacio]');

    function filtrarFilas() {
      const terminos = normalizarTexto(entrada.value).split(/\s+/).filter(Boolean);
      let cantidadVisible = 0;

      for (const fila of filas) {
        const textoFila = normalizarTexto(fila.textContent);
        // Una busqueda vacia vuelve a mostrar todas las filas.
        const coincide = terminos.length === 0
          || terminos.every((termino) => textoFila.includes(termino));
        fila.hidden = !coincide;
        if (coincide) cantidadVisible += 1;
      }

      if (mensajeVacio) mensajeVacio.hidden = terminos.length === 0 || cantidadVisible > 0;
    }

    entrada.addEventListener('input', filtrarFilas);
  });
}

function prepararConfirmaciones() {
  document.querySelectorAll('form[data-confirmar]').forEach((formulario) => {
    formulario.addEventListener('submit', (evento) => {
      const mensaje = formulario.getAttribute('data-confirmar');
      if (!window.confirm(mensaje)) evento.preventDefault();
    });
  });
}

prepararResumenDocentes();
prepararPestanasGestion();
prepararFiltrosDeTablas();
prepararConfirmaciones();
