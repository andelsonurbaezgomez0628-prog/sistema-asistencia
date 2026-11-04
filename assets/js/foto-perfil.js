/*
 * Carga de fotos de perfil.
 * El navegador revisa el archivo y lo reduce para facilitar el envio; la ruta
 * del servidor vuelve a validar tipo, contenido, permisos y token CSRF.
 */
const tiposDeImagenPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
const tamanoMaximoDeImagen = 10 * 1024 * 1024;
const ladoMaximoDeFoto = 512;

function validarArchivoDeFoto(archivo) {
  // Esta comprobacion mejora el mensaje al usuario; el servidor vuelve a validar el archivo recibido.
  if (!tiposDeImagenPermitidos.includes(archivo.type)) {
    return 'Usa una imagen JPG, PNG o WebP de hasta 10 MB.';
  }
  if (archivo.size > tamanoMaximoDeImagen) {
    return 'Usa una imagen JPG, PNG o WebP de hasta 10 MB.';
  }
  return null;
}

/* Preparacion de imagen: conservar proporciones y limitar el lado mas largo. */
async function prepararFotoParaEnviar(archivo) {
  const imagen = await createImageBitmap(archivo);
  const ladoMayor = Math.max(imagen.width, imagen.height);
  const escala = Math.min(1, ladoMaximoDeFoto / ladoMayor);
  const canvas = document.createElement('canvas');

  canvas.width = Math.max(1, Math.round(imagen.width * escala));
  canvas.height = Math.max(1, Math.round(imagen.height * escala));
  canvas.getContext('2d').drawImage(imagen, 0, 0, canvas.width, canvas.height);
  imagen.close();

  // La imagen se reduce antes de enviarla para mantener pequeño el formulario.
  return canvas.toDataURL('image/jpeg', 0.78);
}

/* Envio de datos: la respuesta del servidor confirma si la foto se guardo. */
async function enviarFoto(panel, foto) {
  const respuesta = await fetch(`/fotos/${panel.dataset.tipo}/${panel.dataset.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Las fotos cambian datos y por eso el formulario envia tambien el token CSRF de la sesion.
    body: JSON.stringify({ _csrf: panel.dataset.csrf, foto }),
  });

  const resultado = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(resultado.error || 'No se pudo guardar la foto.');
  }
}

function prepararFormularioDeFoto(panel) {
  const entradaArchivo = panel.querySelector('[data-archivo-foto]');
  const botonGuardar = panel.querySelector('[data-guardar-foto]');
  const mensajeEstado = panel.querySelector('[data-estado-foto]');

  botonGuardar.addEventListener('click', async () => {
    const archivo = entradaArchivo.files?.[0];
    if (!archivo) {
      mensajeEstado.textContent = 'Selecciona una imagen primero.';
      return;
    }

    const errorArchivo = validarArchivoDeFoto(archivo);
    if (errorArchivo) {
      mensajeEstado.textContent = errorArchivo;
      return;
    }

    botonGuardar.disabled = true;
    mensajeEstado.textContent = 'Preparando imagen…';

    try {
      const foto = await prepararFotoParaEnviar(archivo);
      await enviarFoto(panel, foto);
      mensajeEstado.textContent = 'Foto guardada. Actualizando…';
      window.location.reload();
    } catch (error) {
      mensajeEstado.textContent = error.message || 'No se pudo procesar la imagen.';
    } finally {
      botonGuardar.disabled = false;
    }
  });
}

document.querySelectorAll('[data-subida-foto]').forEach(prepararFormularioDeFoto);
