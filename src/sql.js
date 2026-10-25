export function separarSentenciasSql(texto) {
  const sentencias = [];
  let actual = '';
  let comilla = null;
  let comentario = false;

  for (let indice = 0; indice < texto.length; indice += 1) {
    const caracter = texto[indice];
    const siguiente = texto[indice + 1];

    if (comentario) {
      if (caracter === '\n') {
        comentario = false;
        actual += '\n';
      }
      continue;
    }

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