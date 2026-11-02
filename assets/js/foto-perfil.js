document.querySelectorAll('[data-subida-foto]').forEach((panel) => {
  const entrada = panel.querySelector('[data-archivo-foto]');
  const boton = panel.querySelector('[data-guardar-foto]');
  const estado = panel.querySelector('[data-estado-foto]');

  boton.addEventListener('click', async () => {
    const archivo = entrada.files?.[0];
    if (!archivo) {
      estado.textContent = 'Selecciona una imagen primero.';
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type) || archivo.size > 10 * 1024 * 1024) {
      estado.textContent = 'Usa una imagen JPG, PNG o WebP de hasta 10 MB.';
      return;
    }

    boton.disabled = true;
    estado.textContent = 'Preparando imagen…';
    try {
      const imagen = await createImageBitmap(archivo);
      const escala = Math.min(1, 512 / Math.max(imagen.width, imagen.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(imagen.width * escala));
      canvas.height = Math.max(1, Math.round(imagen.height * escala));
      canvas.getContext('2d').drawImage(imagen, 0, 0, canvas.width, canvas.height);
      imagen.close();
      const foto = canvas.toDataURL('image/jpeg', .78);
      const respuesta = await fetch(`/fotos/${panel.dataset.tipo}/${panel.dataset.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _csrf: panel.dataset.csrf, foto }),
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok) throw new Error(resultado.error || 'No se pudo guardar la foto.');
      estado.textContent = 'Foto guardada. Actualizando…';
      window.location.reload();
    } catch (error) {
      estado.textContent = error.message || 'No se pudo procesar la imagen.';
    } finally {
      boton.disabled = false;
    }
  });
});
