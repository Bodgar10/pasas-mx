# Reglas para escribir frases de "Verdadero o mentira"

Juego del reto diario de pasas.mx/arcade. En cada ronda sale **una frase** y el
alumno toca **Verdad** o **Mentira**; al contestar ve la explicación. La primera
frase del día sale además en el reel de Instagram en letra grande.

Público: alumnos de secundaria y prepa en México, en el celular.

## Formato de salida

Un JSON (arreglo) con un objeto por frase:

```json
{
  "topic_id": "uuid del tema, copiado tal cual del contexto",
  "statement": "La frase que se juzga.",
  "is_true": true,
  "explanation": "Verdad: por qué, en una o dos frases.",
  "difficulty": 1
}
```

- `statement`: 10 a 160 caracteres. **Ideal: 12 palabras o menos.** Termina en punto.
- `explanation`: 10 a 260 caracteres. **Empieza con "Verdad: " o "Mentira: "** según `is_true`.
- `difficulty`: 1 fácil · 2 media · 3 difícil. Mezcla aprox.: 40 % 1, 40 % 2, 20 % 3.
- Por tema, exactamente `meta` frases: **mitad verdades, mitad mentiras**.

## Cómo escribir buenas frases

1. **Una sola idea por frase.** Es verdad o mentira por una razón clara, no por un detalle escondido.
2. **Nada de trampas de una letra o de un número chiquito.** "Hidalgo dio el grito en 1811" (y no 1810) no enseña nada y se siente injusto. La mentira debe ser **una confusión común**, de esas en que un alumno sí cae: "Los españoles conquistaron Tenochtitlan solos, sin aliados."
3. **Que sorprenda cuando se pueda.** Las mejores verdades suenan a mentira: "Los mexicas jugaban un juego de pelota que podía terminar en sacrificio."
4. **Sin negaciones dobles** ("No es falso que…") y evita las negaciones en general: es más claro afirmar algo falso que negar algo cierto.
5. **Lenguaje de secundaria y prepa**, tuteo si hace falta, frases cortas. Se lee de un vistazo.
6. **La explicación corrige y enseña.** Si es mentira, di cuál es la verdad: "Mentira: los tlaxcaltecas fueron sus aliados principales; sin ellos no habría caído Tenochtitlan." Si es verdad, agrega el porqué o un dato que amplíe.
7. **Mismo tema:** la frase tiene que ser del `topic_id` que le pones, y que se note que es de ese tema.
8. **Exactitud ante todo.** Si dudas de un dato, no lo uses. Nada discutible, de opinión o que dependa de la fuente. Evita absolutos falsos por tecnicismo ("todos", "nunca") salvo que la mentira sea justo ese absoluto y sea una confusión común.
9. **No copies la pregunta del quiz.** Úsalas como fuente: pregunta + respuesta correcta → verdad; pregunta + incorrecta creíble → mentira. **Reescríbelas como afirmación.**
10. **Sin repetir ideas:** dentro del mismo tema, dos frases no pueden probar el mismo dato (aunque una sea la versión verdadera y otra la falsa). Si te tocan temas hermanos (p. ej. "El Porfiriato" en dos grados), **no repitas ideas entre ellos**: cada tema usa datos distintos.
11. Que la verdad y la mentira **no se delaten por la forma**: no hagas las mentiras más largas ni siempre con "solo", "nunca", "todos".
12. Sin comillas tipográficas raras ni emojis. Usa acentos y ñ correctamente.

## Ejemplos

```json
[
 {"topic_id":"…","statement":"Cortés conquistó Tenochtitlan con la ayuda de miles de guerreros indígenas.","is_true":true,
  "explanation":"Verdad: tlaxcaltecas, totonacas y otros pueblos, hartos del tributo mexica, fueron la mayor parte de su ejército.","difficulty":1},
 {"topic_id":"…","statement":"Porfirio Díaz gobernó México solo cuatro años.","is_true":false,
  "explanation":"Mentira: gobernó más de 30 años (1876-1911), con un breve intervalo de Manuel González.","difficulty":1}
]
```
