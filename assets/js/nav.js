/*
 * Menu principal adaptable.
 * En pantallas pequenas se abre con el boton y se cierra al elegir una ruta;
 * en pantallas grandes permanece visible.
 */
const botonMenu = document.querySelector('[data-nav-toggle]');
const menuPrincipal = document.querySelector('#primaryMenu');
const vistaMovil = window.matchMedia('(max-width: 767.98px)');

function actualizarEstadoDelMenu(estaAbierto) {
  // aria-expanded y aria-label informan a lectores de pantalla del mismo estado visual.
  menuPrincipal.classList.toggle('is-open', estaAbierto);
  botonMenu.setAttribute('aria-expanded', String(estaAbierto));
  botonMenu.setAttribute('aria-label', estaAbierto ? 'Cerrar menu' : 'Abrir menu');
}

function prepararMenuPrincipal() {
  if (!botonMenu || !menuPrincipal) return;

  // Solo ocultamos el menu con JavaScript activo, para no dejarlo inaccesible si falla.
  document.documentElement.classList.add('nav-js');

  botonMenu.addEventListener('click', () => {
    const estaAbierto = botonMenu.getAttribute('aria-expanded') === 'true';
    actualizarEstadoDelMenu(!estaAbierto);
  });

  menuPrincipal.querySelectorAll('a').forEach((enlace) => {
    enlace.addEventListener('click', () => {
      if (vistaMovil.matches) actualizarEstadoDelMenu(false);
    });
  });

  document.addEventListener('keydown', (evento) => {
    const debeCerrar = evento.key === 'Escape'
      && vistaMovil.matches
      && botonMenu.getAttribute('aria-expanded') === 'true';
    if (!debeCerrar) return;

    actualizarEstadoDelMenu(false);
    botonMenu.focus();
  });

  vistaMovil.addEventListener('change', (evento) => {
    // En escritorio el menu queda abierto; en movil empieza cerrado.
    actualizarEstadoDelMenu(!evento.matches);
  });

  actualizarEstadoDelMenu(!vistaMovil.matches);
}

prepararMenuPrincipal();
