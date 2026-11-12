/*
 * Formulario de acceso.
 * Un doble toque en "Entrar" enviaba dos veces el mismo formulario: la primera
 * solicitud regeneraba la sesion y la segunda llegaba con un token CSRF viejo.
 * Bloquear el segundo envio mantiene valida la primera solicitud.
 */
const formularioLogin = document.querySelector('.login-formulario form');
const botonLogin = document.querySelector('[data-boton-login]');
const avisoLogin = document.querySelector('[data-aviso-login]');

function restaurarBotonLogin() {
  if (!botonLogin) return;
  botonLogin.removeAttribute('aria-disabled');
  botonLogin.classList.remove('is-loading');
  const texto = botonLogin.querySelector('[data-texto-login]');
  if (texto) texto.textContent = 'Entrar al panel';
}

if (formularioLogin && botonLogin) {
  let enviando = false;

  formularioLogin.addEventListener('submit', (evento) => {
    if (enviando) {
      evento.preventDefault();
      return;
    }

    enviando = true;
    // aria-disabled y pointer-events evitan un segundo toque sin impedir el envio actual.
    botonLogin.setAttribute('aria-disabled', 'true');
    botonLogin.classList.add('is-loading');
    const texto = botonLogin.querySelector('[data-texto-login]');
    if (texto) texto.textContent = 'Entrando...';
    if (avisoLogin) avisoLogin.textContent = 'Validando tus datos. Espera un momento.';
  });

  // Si el navegador restaura la pagina, el formulario vuelve a estar disponible.
  window.addEventListener('pageshow', () => {
    enviando = false;
    restaurarBotonLogin();
  });
}
