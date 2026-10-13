-- ─────────────────────────────────────────────────────────────────────
-- 062 · Arcade: "Verdadero o mentira" (s46)
--
-- Segundo juego del reto diario, para la prueba A/B contra "¿Cuál sobra?".
-- Mismo día, MISMOS 5 TEMAS que el reto de "¿Cuál sobra?" de esa fecha: en
-- vez de 4 opciones, una frase y dos botones. Así la prueba compara el juego,
-- no los temas.
--
--   arcade_vom_rounds      banco de frases (lo llena el chat de contenido)
--   arcade_vom_challenges  las 5 frases elegidas para cada fecha
--   arcade_vom_plays       partidas (una por navegador por día)
--
-- Igual que 051: RLS sin políticas para anon; todo pasa por funciones
-- SECURITY DEFINER que solo ejecuta service_role (el servidor).
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE public.arcade_vom_rounds (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id    uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  -- La frase que se juzga. Corta: se lee en el celular de un vistazo.
  statement   text NOT NULL CHECK (char_length(statement) BETWEEN 10 AND 160),
  is_true     boolean NOT NULL,
  -- Por qué es verdad o mentira. Se muestra al contestar.
  explanation text NOT NULL CHECK (char_length(explanation) BETWEEN 10 AND 260),
  difficulty  smallint NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
  status      text NOT NULL DEFAULT 'borrador'
              CHECK (status IN ('borrador', 'aprobada', 'rechazada')),
  source      text NOT NULL DEFAULT 'claude',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_id, statement)
);

CREATE INDEX idx_arcade_vom_rounds_topic ON public.arcade_vom_rounds(topic_id) WHERE status = 'aprobada';

CREATE TABLE public.arcade_vom_challenges (
  challenge_date date PRIMARY KEY REFERENCES public.arcade_challenges(challenge_date) ON DELETE CASCADE,
  round_ids      uuid[] NOT NULL CHECK (array_length(round_ids, 1) = 5),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.arcade_vom_plays (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  challenge_date date NOT NULL REFERENCES public.arcade_vom_challenges(challenge_date) ON DELETE CASCADE,
  anon_id        text NOT NULL CHECK (length(anon_id) BETWEEN 8 AND 64),
  results        boolean[] NOT NULL CHECK (array_length(results, 1) = 5),
  -- 0 = "Verdad", 1 = "Mentira"
  picks          smallint[] NOT NULL CHECK (array_length(picks, 1) = 5 AND picks <@ ARRAY[0, 1]::smallint[]),
  score          smallint NOT NULL CHECK (score BETWEEN 0 AND 5),
  origen         text,
  canal          text,
  utm_source     text,
  utm_campaign   text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_date, anon_id)
);

ALTER TABLE public.arcade_vom_rounds     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arcade_vom_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arcade_vom_plays      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arcade_vom_rounds_admin" ON public.arcade_vom_rounds
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "arcade_vom_challenges_admin" ON public.arcade_vom_challenges
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "arcade_vom_plays_admin" ON public.arcade_vom_plays
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- ─────────────────────────────────────────────────────────────────────
-- Arma las 5 frases de una fecha a partir del reto de "¿Cuál sobra?" de esa
-- misma fecha: una frase aprobada por cada tema, en el mismo orden.
-- Mezcla verdades y mentiras: alterna la que busca (empieza según la fecha)
-- y, si el tema no tiene de ese tipo, toma la otra. Determinista por fecha.
-- Idempotente. Devuelve false si algún tema no tiene frases aprobadas.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.arcade_vom_armar(p_date date)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ids    uuid[] := '{}';
  v_id     uuid;
  v_topic  uuid;
  v_quiere boolean;
  v_i      int := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM public.arcade_vom_challenges WHERE challenge_date = p_date) THEN
    RETURN true;
  END IF;

  FOR v_topic IN
    SELECT r.topic_id
      FROM public.arcade_challenges c
     CROSS JOIN LATERAL unnest(c.round_ids) WITH ORDINALITY AS u(id, ord)
      JOIN public.arcade_rounds r ON r.id = u.id
     WHERE c.challenge_date = p_date
     ORDER BY u.ord
  LOOP
    v_i := v_i + 1;
    v_quiere := ((extract(doy FROM p_date)::int + v_i) % 2) = 0;
    SELECT v.id INTO v_id
      FROM public.arcade_vom_rounds v
     WHERE v.topic_id = v_topic AND v.status = 'aprobada' AND NOT (v.id = ANY (v_ids))
     ORDER BY (v.is_true = v_quiere) DESC, md5(v.id::text || p_date::text)
     LIMIT 1;
    IF v_id IS NULL THEN
      RETURN false;
    END IF;
    v_ids := v_ids || v_id;
  END LOOP;

  IF coalesce(array_length(v_ids, 1), 0) <> 5 THEN
    RETURN false;
  END IF;

  INSERT INTO public.arcade_vom_challenges (challenge_date, round_ids)
  VALUES (p_date, v_ids)
  ON CONFLICT (challenge_date) DO NOTHING;
  RETURN true;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- El reto de "Verdadero o mentira" de una fecha, con la misma forma que
-- arcade_reto() para que el cliente lo trate igual: options ['Verdad',
-- 'Mentira'] y odd = 0 si es verdad, 1 si es mentira. NULL si no se arma.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.arcade_vom_reto(p_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_c public.arcade_challenges;
  v_v public.arcade_vom_challenges;
BEGIN
  IF NOT public.arcade_vom_armar(p_date) THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_c FROM public.arcade_challenges WHERE challenge_date = p_date;
  SELECT * INTO v_v FROM public.arcade_vom_challenges WHERE challenge_date = p_date;
  IF v_c IS NULL OR v_v IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'date',    v_c.challenge_date,
    'number',  v_c.number,
    'materia', v_c.materia,
    'rounds', (
      SELECT jsonb_agg(jsonb_build_object(
               'id',           r.id,
               'statement',    r.statement,
               'options',      to_jsonb(ARRAY['Verdad', 'Mentira']),
               'odd',          CASE WHEN r.is_true THEN 0 ELSE 1 END,
               'explanation',  r.explanation,
               'kind',         'vom',
               'topic',        t.name,
               'topic_slug',   t.slug,
               'subject_slug', s.slug,
               'materia',      public.arcade_materia_de_slug(s.slug),
               'horde_ready',  t.horde_ready AND t.published
             ) ORDER BY u.ord)
        FROM unnest(v_v.round_ids) WITH ORDINALITY AS u(id, ord)
        JOIN public.arcade_vom_rounds r ON r.id = u.id
        JOIN public.topics t   ON t.id = r.topic_id
        JOIN public.subjects s ON s.id = t.subject_id
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.arcade_vom_cifras(p_date date)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'players', count(*),
    'avg',     round(avg(score)::numeric, 2),
    'per_round', (
      SELECT jsonb_agg(pct ORDER BY i)
      FROM (
        SELECT i, round(100.0 * avg((p.results[i])::int)) AS pct
        FROM generate_series(1, 5) AS i
        LEFT JOIN public.arcade_vom_plays p ON p.challenge_date = p_date
        GROUP BY i
      ) x
    ),
    'dist', (
      SELECT jsonb_agg(n ORDER BY s)
      FROM (
        SELECT s, (SELECT count(*) FROM public.arcade_vom_plays p
                   WHERE p.challenge_date = p_date AND p.score = s) AS n
        FROM generate_series(0, 5) AS s
      ) y
    )
  )
  FROM public.arcade_vom_plays
  WHERE challenge_date = p_date;
$$;

CREATE OR REPLACE FUNCTION public.arcade_vom_registrar(
  p_date date,
  p_anon_id text,
  p_picks smallint[],
  p_origen text DEFAULT NULL,
  p_canal text DEFAULT NULL,
  p_utm_source text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hoy     date := public.arcade_hoy();
  v_results boolean[];
  v_origen  text := CASE WHEN p_origen IN ('landing_banner', 'resultado_compartido', 'arcade', 'directo') THEN p_origen END;
  v_canal   text := CASE WHEN p_canal IN ('instagram', 'tiktok', 'facebook', 'whatsapp', 'google', 'email', 'directo', 'otro') THEN p_canal END;
BEGIN
  IF p_date > v_hoy OR p_date < v_hoy - 7
     OR coalesce(array_length(p_picks, 1), 0) <> 5
     OR NOT (p_picks <@ ARRAY[0, 1]::smallint[])
     OR length(coalesce(p_anon_id, '')) NOT BETWEEN 8 AND 64 THEN
    RETURN NULL;
  END IF;

  SELECT array_agg(p_picks[u.ord::int] = (CASE WHEN r.is_true THEN 0 ELSE 1 END) ORDER BY u.ord)
    INTO v_results
    FROM public.arcade_vom_challenges c
   CROSS JOIN LATERAL unnest(c.round_ids) WITH ORDINALITY AS u(id, ord)
    JOIN public.arcade_vom_rounds r ON r.id = u.id
   WHERE c.challenge_date = p_date;

  IF v_results IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.arcade_vom_plays
    (challenge_date, anon_id, results, picks, score, origen, canal, utm_source, utm_campaign)
  VALUES (
    p_date, p_anon_id, v_results, p_picks,
    (SELECT count(*) FROM unnest(v_results) AS x WHERE x),
    v_origen, v_canal,
    left(nullif(trim(p_utm_source), ''), 64),
    left(nullif(trim(p_utm_campaign), ''), 64)
  )
  ON CONFLICT (challenge_date, anon_id) DO NOTHING;

  RETURN public.arcade_vom_cifras(p_date);
END;
$$;

REVOKE ALL ON FUNCTION public.arcade_vom_armar(date) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.arcade_vom_reto(date) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.arcade_vom_cifras(date) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.arcade_vom_registrar(date, text, smallint[], text, text, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.arcade_vom_armar(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.arcade_vom_reto(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.arcade_vom_cifras(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.arcade_vom_registrar(date, text, smallint[], text, text, text, text) TO service_role;
