-- PASAS Arcade · tanda 01 — 40 rondas "¿Cuál sobra?" de historia.
-- Escritas a partir de los key_fact y tip de cada tema (sections base).
-- Idempotente: ON CONFLICT (topic_id, options) no duplica.
INSERT INTO public.arcade_rounds (topic_id, options, odd_index, explanation, difficulty, kind, status) VALUES
-- La Conquista de México
('1951acfb-85b6-49c7-ba40-9ddeb2066a92', ARRAY['Tlaxcaltecas','Viruela','Caballos y armas de acero','Tratado de Córdoba'], 3,
 'Los tlaxcaltecas, la viruela y las armas europeas explican la caída de Tenochtitlan en 1521. El Tratado de Córdoba es de 1821 y reconoció la independencia de México.', 1, 'text', 'aprobada'),
('1951acfb-85b6-49c7-ba40-9ddeb2066a92', ARRAY['Hernán Cortés','Pedro de Alvarado','Malintzin','Cuauhtémoc'], 3,
 'Cortés, Alvarado y Malintzin, su intérprete, estuvieron del lado de la expedición española. Cuauhtémoc fue el último tlatoani mexica y defendió Tenochtitlan hasta 1521.', 2, 'text', 'aprobada'),
-- La Colonia: organización política y social
('315652fb-77f3-4fb1-abc1-1ca2f89525fb', ARRAY['Virrey','Real Audiencia','Cabildo','Congreso de Chilpancingo'], 3,
 'El virrey, la Real Audiencia y el cabildo gobernaban la Nueva España. El Congreso de Chilpancingo lo convocó Morelos en 1813, en plena guerra de Independencia.', 2, 'text', 'aprobada'),
-- El virreinato: economía y cultura
('d0d83abd-6032-4ee6-8a34-e5f1c464f3a0', ARRAY['Minería de plata','Monopolio comercial con España','Nao de China','Ferrocarriles'], 3,
 'La plata, el monopolio comercial y la Nao de China movían la economía del virreinato. Los ferrocarriles llegaron en el siglo XIX y crecieron sobre todo en el Porfiriato.', 1, 'text', 'aprobada'),
-- Reformas borbónicas
('7e4cbabb-07d8-4e27-99aa-78c6d427ed99', ARRAY['Intendencias','Más impuestos','Expulsión de los jesuitas','Leyes de Reforma'], 3,
 'Las intendencias, los nuevos impuestos y la expulsión de los jesuitas (1767) fueron reformas borbónicas del siglo XVIII. Las Leyes de Reforma son de Juárez, a mediados del siglo XIX.', 2, 'text', 'aprobada'),
-- Independencia de México: causas y etapas
('a7dbb36f-8f4b-4ce8-9cdc-d76b2054125a', ARRAY['Miguel Hidalgo','José María Morelos','Porfirio Díaz','Vicente Guerrero'], 2,
 'Hidalgo, Morelos y Guerrero lucharon por la Independencia (1810–1821). Porfirio Díaz gobernó décadas después, en el Porfiriato.', 1, 'text', 'aprobada'),
('a7dbb36f-8f4b-4ce8-9cdc-d76b2054125a', ARRAY['Grito de Dolores','Sentimientos de la Nación','Ejército Trigarante','Plan de Ayala'], 3,
 'El Grito de Dolores (1810), los Sentimientos de la Nación (1813) y el Ejército Trigarante (1821) son de la Independencia. El Plan de Ayala lo proclamó Zapata en 1911, en la Revolución.', 2, 'text', 'aprobada'),
('a7dbb36f-8f4b-4ce8-9cdc-d76b2054125a', ARRAY['1810','1813','1821','1917'], 3,
 'En 1810 empezó la Independencia, en 1813 Morelos presentó los Sentimientos de la Nación y en 1821 se consumó. 1917 es el año de la Constitución que surgió de la Revolución.', 2, 'year', 'aprobada'),
-- México independiente: primeras décadas
('ddcc7a2e-932e-4588-ba44-8ecc4bf54207', ARRAY['Agustín de Iturbide','Antonio López de Santa Anna','Guadalupe Victoria','Lázaro Cárdenas'], 3,
 'Iturbide, Guadalupe Victoria y Santa Anna gobernaron México en sus primeras décadas como país independiente. Cárdenas fue presidente de 1934 a 1940.', 1, 'text', 'aprobada'),
('ddcc7a2e-932e-4588-ba44-8ecc4bf54207', ARRAY['Federalistas','Centralistas','Primer Imperio','Maximato'], 3,
 'Federalistas contra centralistas y el Primer Imperio de Iturbide marcaron las primeras décadas tras 1821. El Maximato fue de 1928 a 1934, cuando Calles mandaba tras la silla presidencial.', 3, 'text', 'aprobada'),
-- La Reforma y las Leyes de Reforma
('0ed5daee-9031-4e6f-a99c-99b3c38a25bc', ARRAY['Benito Juárez','Maximiliano de Habsburgo','Melchor Ocampo','Miguel Lerdo de Tejada'], 1,
 'Juárez, Ocampo y Lerdo de Tejada impulsaron las Leyes de Reforma. Maximiliano fue el emperador del Segundo Imperio al que se enfrentaron los liberales.', 2, 'text', 'aprobada'),
('0ed5daee-9031-4e6f-a99c-99b3c38a25bc', ARRAY['Ley Juárez','Ley Lerdo','Ley Iglesias','Plan de San Luis'], 3,
 'La Ley Juárez (fueros), la Ley Lerdo (desamortización) y la Ley Iglesias (cobros del clero) son leyes de la Reforma, entre 1855 y 1857. El Plan de San Luis lo lanzó Madero en 1910.', 2, 'text', 'aprobada'),
('0ed5daee-9031-4e6f-a99c-99b3c38a25bc', ARRAY['Registro civil','Separación Iglesia-Estado','Fin de los fueros','Expropiación petrolera'], 3,
 'El registro civil, la separación Iglesia-Estado y el fin de los fueros son logros de la Reforma liberal. La expropiación petrolera la hizo Cárdenas en 1938.', 1, 'text', 'aprobada'),
-- El Porfiriato (Historia de México II)
('1ac4628e-954c-4297-bcbe-da74f1a36746', ARRAY['Ferrocarriles','Inversión extranjera','Tiendas de raya','Reparto de ejidos'], 3,
 'Ferrocarriles, inversión extranjera y tiendas de raya retratan el Porfiriato: progreso para pocos y deudas para los peones. El reparto de ejidos llegó después de la Revolución, sobre todo con Cárdenas.', 2, 'text', 'aprobada'),
-- El Porfiriato (Historia 2°)
('5693c3d2-9301-4513-8933-dbcc3b80ee5e', ARRAY['Porfirio Díaz','José Yves Limantour','Los científicos','Emiliano Zapata'], 3,
 'Díaz, su secretario de Hacienda Limantour y el grupo de los científicos formaban el gobierno porfirista. Zapata se levantó en armas contra ese orden.', 3, 'text', 'aprobada'),
-- La Revolución Mexicana (Historia 3°)
('30b2a918-244e-461a-91de-dea1ce9d2e8a', ARRAY['Agustín de Iturbide','Francisco I. Madero','Emiliano Zapata','Francisco Villa'], 0,
 'Madero, Zapata y Villa fueron líderes de la Revolución de 1910. Iturbide consumó la Independencia en 1821 y se coronó emperador en 1822.', 1, 'text', 'aprobada'),
-- La Revolución Mexicana (Historia de México II)
('6e255332-cf17-4ffa-9581-04bc4f4524be', ARRAY['Plan de San Luis','Plan de Ayala','Plan de Guadalupe','Plan de Iguala'], 3,
 'Los planes de San Luis (Madero, 1910), Ayala (Zapata, 1911) y Guadalupe (Carranza, 1913) son de la Revolución. El Plan de Iguala es de 1821: lo firmaron Iturbide y Guerrero para consumar la Independencia.', 3, 'text', 'aprobada'),
('6e255332-cf17-4ffa-9581-04bc4f4524be', ARRAY['Francisco I. Madero','Emiliano Zapata','Venustiano Carranza','Victoriano Huerta'], 3,
 'Madero, Zapata y Carranza fueron revolucionarios. Huerta traicionó a Madero en la Decena Trágica de 1913 y fue el enemigo al que se unieron a derrotar.', 2, 'text', 'aprobada'),
-- La Constitución de 1917 (Historia de México II)
('a204f08d-1e25-4413-8d0d-e3950af756ba', ARRAY['1857','1824','1910','1917'], 2,
 'En 1824, 1857 y 1917 se promulgaron constituciones. 1910 es el año en que empezó la Revolución.', 2, 'year', 'aprobada'),
-- La Constitución de 1917 (Historia 3°)
('6a72ddf2-6a6f-4c99-9a0d-531f5c2a4bc7', ARRAY['Poder Ejecutivo','Poder Legislativo','Poder Judicial','Poder Militar'], 3,
 'La Constitución de 1917 divide el poder en tres: el Ejecutivo gobierna, el Legislativo hace las leyes y el Judicial juzga. No existe un poder militar: el ejército obedece al Ejecutivo.', 1, 'text', 'aprobada'),
-- El Cardenismo
('80fef1e1-79e6-4ef7-88d5-289567c62311', ARRAY['Expropiación petrolera','Reparto agrario','Fundación de la CTM','Tratado de Libre Comercio'], 3,
 'La expropiación petrolera, el reparto agrario y el apoyo a la CTM son del cardenismo (1934–1940). El Tratado de Libre Comercio entró en vigor en 1994, con Salinas.', 1, 'text', 'aprobada'),
-- México posrevolucionario (Historia 3°)
('fb7597b7-6809-46b8-b9cf-e572d1445f6b', ARRAY['Álvaro Obregón','Plutarco Elías Calles','Lázaro Cárdenas','Carlos Salinas de Gortari'], 3,
 'Obregón, Calles y Cárdenas gobernaron el México posrevolucionario entre 1920 y 1940. Salinas fue presidente de 1988 a 1994, en la etapa neoliberal.', 2, 'text', 'aprobada'),
-- México posrevolucionario y el cardenismo (Historia de México II)
('2545da16-4d58-42e5-84e1-4435941e587f', ARRAY['PNR','PRM','PRI','PAN'], 3,
 'PNR (1929), PRM (1938) y PRI (1946) son el mismo partido con tres nombres. El PAN se fundó en 1939 como partido de oposición.', 3, 'text', 'aprobada'),
-- El Milagro Mexicano
('d9ee5965-e548-46c5-af97-33fdd33611a5', ARRAY['Industrialización','Sustitución de importaciones','Crecimiento sostenido','Crisis de la deuda de 1982'], 3,
 'Industrialización, sustitución de importaciones y crecimiento sostenido definen el Milagro Mexicano (1940–1970). La crisis de la deuda de 1982 llegó después y abrió la etapa neoliberal.', 2, 'text', 'aprobada'),
-- El movimiento estudiantil de 1968
('b84f80db-943d-42bd-90e7-a05d4575a587', ARRAY['UNAM','IPN','Consejo Nacional de Huelga','EZLN'], 3,
 'Estudiantes de la UNAM y del IPN se unieron en el Consejo Nacional de Huelga en 1968. El EZLN se levantó en Chiapas en 1994.', 2, 'text', 'aprobada'),
('b84f80db-943d-42bd-90e7-a05d4575a587', ARRAY['Marcha del Silencio','Mítines','Brigadas estudiantiles','Toma de la Alhóndiga'], 3,
 'La Marcha del Silencio, los mítines y las brigadas fueron formas de protesta pacífica del movimiento de 1968. La toma de la Alhóndiga de Granaditas fue en 1810, con Hidalgo.', 2, 'text', 'aprobada'),
-- México contemporáneo (1968 a la actualidad)
('353df7bd-e4ae-45f1-8ee0-886c9f62b30e', ARRAY['1968','1985','1994','1938'], 3,
 '1968 (Tlatelolco), 1985 (el sismo) y 1994 (el levantamiento del EZLN) son hitos del México contemporáneo. 1938 es el año de la expropiación petrolera.', 2, 'year', 'aprobada'),
-- Crisis y neoliberalismo en México
('22ba57fc-7085-4051-9e10-3dc04fea3dd4', ARRAY['Miguel de la Madrid','Carlos Salinas de Gortari','Ernesto Zedillo','Adolfo López Mateos'], 3,
 'De la Madrid, Salinas y Zedillo gobernaron en los años 80 y 90, la etapa neoliberal. López Mateos fue presidente de 1958 a 1964, en pleno Milagro Mexicano.', 3, 'text', 'aprobada'),
('22ba57fc-7085-4051-9e10-3dc04fea3dd4', ARRAY['Devaluación','Inflación','Desempleo','Reparto agrario'], 3,
 'Devaluación, inflación y desempleo fueron los golpes de las crisis de 1982 y 1994. El reparto agrario es una política de la posrevolución, no un efecto de las crisis.', 1, 'text', 'aprobada'),
-- Transición democrática
('29352c29-7676-41e7-95d5-7267e45395bf', ARRAY['Vicente Fox','IFE','Elecciones de 1997','Plan de Agua Prieta'], 3,
 'El IFE, las elecciones de 1997 (el PRI pierde la mayoría en el Congreso) y el triunfo de Fox en 2000 marcan la transición democrática. El Plan de Agua Prieta es de 1920, contra Carranza.', 3, 'text', 'aprobada'),
-- Las revoluciones modernas (Historia 2°)
('40909e7d-574a-4fc1-a773-e542c7986299', ARRAY['Máquina de vapor','Fábricas','Ferrocarril','Toma de la Bastilla'], 3,
 'La máquina de vapor, las fábricas y el ferrocarril son de la Revolución Industrial. La toma de la Bastilla (1789) inició la Revolución Francesa.', 1, 'text', 'aprobada'),
-- Primera Guerra Mundial
('3e5dca49-5389-461e-acff-e1d6be7a90bd', ARRAY['Guerra de trincheras','Triple Entente','Archiduque Francisco Fernando','Desembarco de Normandía'], 3,
 'Las trincheras, la Triple Entente y el asesinato del archiduque Francisco Fernando son de la Primera Guerra Mundial (1914–1918). El desembarco de Normandía fue en 1944, en la Segunda.', 1, 'text', 'aprobada'),
-- Revolución Rusa
('cf52ffb4-005e-45b1-bc62-bfcc5a245ed3', ARRAY['Lenin','Bolcheviques','Sóviets','Robespierre'], 3,
 'Lenin, los bolcheviques y los sóviets protagonizaron la Revolución Rusa de 1917. Robespierre fue un líder de la Revolución Francesa.', 2, 'text', 'aprobada'),
-- Segunda Guerra Mundial
('134cd9c9-73b8-415b-ad24-40e13566e5f4', ARRAY['Día D','Pearl Harbor','Hiroshima','Muro de Berlín'], 3,
 'El Día D (1944), Pearl Harbor (1941) e Hiroshima (1945) son de la Segunda Guerra Mundial. El Muro de Berlín se levantó en 1961, en la Guerra Fría.', 1, 'text', 'aprobada'),
-- La Guerra Fría
('cda21f9c-a87b-49cc-bb30-2f6d7a85fa13', ARRAY['OTAN','Pacto de Varsovia','Carrera espacial','Triple Alianza'], 3,
 'La OTAN, el Pacto de Varsovia y la carrera espacial son de la Guerra Fría (1947–1991). La Triple Alianza fue uno de los bandos de la Primera Guerra Mundial.', 2, 'text', 'aprobada'),
-- Descolonización de Asia y África
('a56fca8c-fba2-4e82-87ec-f0970804b479', ARRAY['India','Argelia','Ghana','Brasil'], 3,
 'India (1947), Ghana (1957) y Argelia (1962) se independizaron en la descolonización posterior a 1945. Brasil se independizó de Portugal en 1822.', 3, 'text', 'aprobada'),
-- La ONU y los derechos humanos
('d404dcea-5902-4763-a209-b05847ab626a', ARRAY['Derecho a la vida','Derecho a la educación','Derecho a la libertad','Derecho de conquista'], 3,
 'La vida, la educación y la libertad están en la Declaración Universal de los Derechos Humanos (1948). El "derecho de conquista" era la excusa de los imperios para quedarse con territorios ajenos.', 1, 'text', 'aprobada'),
-- Imperialismo y colonialismo
('5fc2cc23-16d4-4c16-844c-3f4a73265c02', ARRAY['Reino Unido','Francia','Bélgica','Suiza'], 3,
 'Reino Unido, Francia y Bélgica tuvieron colonias en África durante el imperialismo del siglo XIX. Suiza nunca tuvo colonias.', 2, 'text', 'aprobada')
ON CONFLICT (topic_id, options) DO NOTHING;

-- Revuelve el orden de las opciones: escritas a mano, la que sobra quedaba
-- casi siempre al final y el patrón delataba la respuesta.
WITH p AS (
  SELECT id, options[odd_index + 1] AS odd_text,
         (SELECT array_agg(o ORDER BY random()) FROM unnest(options) o) AS sh
  FROM public.arcade_rounds
  WHERE source = 'claude' AND created_at > now() - interval '1 minute'
)
UPDATE public.arcade_rounds r
SET options = p.sh, odd_index = array_position(p.sh, p.odd_text) - 1
FROM p WHERE p.id = r.id;

-- Deja lista la semana.
SELECT public.arcade_llenar_calendario(7);
