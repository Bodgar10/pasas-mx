-- Tecnología 1° · 2 correcciones que el conector de Supabase cancela solo
-- (filtro automático, no aviso de confirmación). Pegar en el SQL Editor del
-- dashboard de Supabase y correr. Los JSON del repo ya tienen este texto.
-- Borrar este archivo después.

UPDATE public.sections
   SET content = replace(content,
       'Hace años, a los artistas los subían al escenario empujando escaleras a mano; hoy la plataforma hace ese trabajo.',
       'Antes, las integrantes tenían que subir al escenario por una escalera, con sus propias piernas; hoy la plataforma elevadora hace ese trabajo.')
 WHERE topic_id = (SELECT id FROM public.topics WHERE slug = 'medios-tecnicos-tec-1')
   AND theme_id = (SELECT id FROM public.themes WHERE name = 'K-pop & K-dramas')
   AND user_id IS NULL AND type = 'analogy';

UPDATE public.horde_questions
   SET explanation = 'Las dos cortan; las tijeras funcionan con la fuerza de tu mano y la cortadora con un motor que transforma energía eléctrica.'
 WHERE topic_id = (SELECT id FROM public.topics WHERE slug = 'medios-tecnicos-tec-1')
   AND question = '¿Qué diferencia hay entre unas tijeras y una cortadora eléctrica de papel?';
