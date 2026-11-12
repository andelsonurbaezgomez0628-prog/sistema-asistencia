/*
 * Barra de carga entre paginas.
 * Se muestra cuando el docente navega o envia un formulario y la respuesta
 * tarda mas de un instante; en conexiones lentas avisa que el sistema trabaja.
 */
const RETRASO_BARRA = 140;

function crearBarraCarga() {
  const barra = document.createElement('div');
  barra.className = 'barra-carga-pagina';
  barra.setAttribute('aria-hidden', 'true');
  document.body.append(barra);
  return barra;
}

// El enlace apunta a otra pagina del mismo sitio y no abre una pestana nueva.
function esNavegacionInterna(enlace) {
  if (!enlace || enlace.target === '_blank' || enlace.hasAttribute('download')) return false;
  const destino = new URL(enlace.href, window.location.href);
  if (destino.origin !== window.location.origin) return false;
  // Un enlace que solo cambia el ancla no descarga otra pagina.
  return destino.pathname !== window.location.pathname
    || destino.search !== window.location.search;
}

if (document.body) {
  const barraCarga = crearBarraCarga();
  let temporizadorBarra = null;

  function mostrarBarraCarga() {
    window.clearTimeout(temporizadorBarra);
    // El retraso evita que las paginas rapidas muestren un parpadeo.
    temporizadorBarra = window.setTimeout(() => {
      barraCarga.classList.add('is-visible');
    }, RETRASO_BARRA);
  }

  function ocultarBarraCarga() {
    window.clearTimeout(temporizadorBarra);
    barraCarga.classList.remove('is-visible');
  }

  // Al volver con el boton Atras el navegador puede restaurar la pagina desde cache.
  window.addEventListener('pageshow', ocultarBarraCarga);

  document.addEventListener('click', (evento) => {
    if (evento.defaultPrevented || evento.button !== 0) return;
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
    const enlace = evento.target.closest('a[href]');
    if (esNavegacionInterna(enlace)) mostrarBarraCarga();
  });

  // Guardar asistencia o filtrar reportes tambien espera al servidor.
  document.addEventListener('submit', (evento) => {
    if (!evento.defaultPrevented) mostrarBarraCarga();
  });
}
