/*
 * Separador para los scripts de instalacion del proyecto.
 * Evita dividir por punto y coma si este aparece dentro de una cadena o despues
 * del inicio de un comentario de linea.
 */
export function separarSentenciasSql(texto) {
  const sentencias = [];
  let sentenciaActual = '';
  // El punto y coma solo separa consultas cuando estamos fuera de texto y comentarios.
  // Este separador cubre las comillas y comentarios de linea de los scripts del proyecto;
  // no intenta interpretar todas las variantes del lenguaje SQL.
  let delimitadorCadena = null;
  let dentroDeComentario = false;

  for (let indiceCaracter = 0; indiceCaracter < texto.length; indiceCaracter += 1) {
    const caracter = texto[indiceCaracter];
    const siguienteCaracter = texto[indiceCaracter + 1];

    // Ignorar comentarios de una linea, pero conservar su salto para no unir palabras.
    if (dentroDeComentario) {
      if (caracter === '\n') {
        dentroDeComentario = false;
        sentenciaActual += '\n';
      }
      continue;
    }

    // Dentro de una cadena, un punto y coma forma parte del texto SQL.
    if (delimitadorCadena) {
      sentenciaActual += caracter;
      if (caracter === '\\' && indiceCaracter + 1 < texto.length) {
        sentenciaActual += texto[indiceCaracter + 1];
        indiceCaracter += 1;
      } else if (caracter === delimitadorCadena) {
        if (siguienteCaracter === delimitadorCadena) {
          sentenciaActual += siguienteCaracter;
          indiceCaracter += 1;
        } else {
          delimitadorCadena = null;
        }
      }
      continue;
    }

    // Fuera de una cadena, reconocer comentarios, comillas y fin de sentencia.
    if (caracter === '-' && siguienteCaracter === '-') {
      dentroDeComentario = true;
      indiceCaracter += 1;
    } else if (caracter === "'" || caracter === '"' || caracter === '`') {
      delimitadorCadena = caracter;
      sentenciaActual += caracter;
    } else if (caracter === ';') {
      if (sentenciaActual.trim()) sentencias.push(sentenciaActual.trim());
      sentenciaActual = '';
    } else {
      sentenciaActual += caracter;
    }
  }

  if (sentenciaActual.trim()) sentencias.push(sentenciaActual.trim());
  return sentencias;
}
