# Preguntas de diagnóstico agregadas (s43)

`agregados-s43.json` guarda, por materia, las preguntas de `diagnostic_questions`
que se escribieron a mano en s43 para los temas publicados que no tenían ninguna
(37 materias, 224 preguntas: 30 de prepa completas y 7 temas sueltos de secundaria).
Ya están cargadas en Supabase; este archivo es respaldo y referencia.

Formato por pregunta: `slug` del tema, `question`, `options` [{letter,text}],
`correct_answer`, `explanation`. `display_order` se calcula en la base por el orden
de los temas publicados de la materia y grado.

Reglas usadas: una pregunta por tema, 4 opciones, la correcta nunca más larga
que el distractor más largo, explicación de 60 palabras como máximo.
