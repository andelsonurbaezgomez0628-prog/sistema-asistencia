export function separarSentenciasSql(texto) {
  const sentencias = [];
  let actual = '';
  // El punto y coma solo separa consultas cuando estamos fuera de texto y comentarios.
  let comilla = null;
  let comentario = false;

  for (let indice = 0; indice < texto.length; indice += 1) {
    const caracter = texto[indice];
    const siguiente = texto[indice + 1];

    // Ignorar comentarios de una linea, pero conservar su salto para no unir palabras.
    if (comentario) {
      if (caracter === '\n') {
        comentario = false;
        actual += '\n';
      }
      continue;
    }

    // Dentro de una cadena, un punto y coma forma parte del texto SQL.
    if (comilla) {
      actual += caracter;
      if (caracter === '\\' && indice + 1 < texto.length) {
        actual += texto[indice + 1];
        indice += 1;
      } else if (caracter === comilla) {
        if (siguiente === comilla) {
          actual += siguiente;
          indice += 1;
        } else {
          comilla = null;
        }
      }
      continue;
    }

    // Fuera de una cadena, reconocer comentarios, comillas y fin de sentencia.
    if (caracter === '-' && siguiente === '-') {
      comentario = true;
      indice += 1;
    } else if (caracter === "'" || caracter === '"' || caracter === '`') {
      comilla = caracter;
      actual += caracter;
    } else if (caracter === ';') {
      if (actual.trim()) sentencias.push(actual.trim());
      actual = '';
    } else {
      actual += caracter;
    }
  }

  if (actual.trim()) sentencias.push(actual.trim());
  return sentencias;
}
