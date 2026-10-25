const botonMenu = document.querySelector('[data-nav-toggle]');
const menu = document.querySelector('#primaryMenu');
const mobileQuery = window.matchMedia('(max-width: 767.98px)');

if (botonMenu && menu) {
  document.documentElement.classList.add('nav-js');

  function establecerMenu(abierto) {
    menu.classList.toggle('is-open', abierto);
    botonMenu.setAttribute('aria-expanded', String(abierto));
    botonMenu.setAttribute('aria-label', abierto ? 'Cerrar menu' : 'Abrir menu');
  }

  botonMenu.addEventListener('click', () => {
    establecerMenu(botonMenu.getAttribute('aria-expanded') !== 'true');
  });

  menu.querySelectorAll('a').forEach((enlace) => {
    enlace.addEventListener('click', () => {
      if (mobileQuery.matches) establecerMenu(false);
    });
  });

  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && mobileQuery.matches && botonMenu.getAttribute('aria-expanded') === 'true') {
      establecerMenu(false);
      botonMenu.focus();
    }
  });

  mobileQuery.addEventListener('change', (evento) => establecerMenu(!evento.matches));
  establecerMenu(!mobileQuery.matches);
}
