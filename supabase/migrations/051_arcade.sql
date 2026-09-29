-- =====================================================
-- 051 · PASAS Arcade — reto diario "¿Cuál sobra?"
-- Pasas.mx · primera pieza pública sin login
--
-- Tres tablas:
--   arcade_rounds      banco de rondas (4 opciones, 1 sobra), ligadas a un topic
--                      para el puente a la Horda de ese tema.
--   arcade_challenges  calendario: qué 5 rondas van cada día.
--   arcade_plays       partidas anónimas; de aquí sale "solo el 34% acertó".
--
-- ── POR QUÉ NADIE LEE LAS TABLAS DIRECTO ─────────────────────────────
-- RLS encendido y SIN políticas para anon ni authenticated. Todo pasa por
-- funciones SECURITY DEFINER con EXECUTE revocado a anon/authenticated, que
-- llama el servidor con service role (mismo patrón que landing_stats y
-- preview_stats). Así un reto futuro no se puede leer desde el navegador,
-- que es lo que arruinaría los reels de la semana.
--
-- ── LA FECHA ES LA DE LA CIUDAD DE MÉXICO ────────────────────────────
-- `arcade_hoy()` es la única fuente. Vercel y Postgres corren en UTC: un
-- reto calculado con current_date cambiaría a las 6 PM.
--
-- ── NUNCA SALE UN RETO VACÍO ─────────────────────────────────────────
-- Si el día no tiene reto, `arcade_reto()` lo arma en ese momento con el
-- banco. Si el banco no alcanza, devuelve el más reciente. El calendario se
-- puede llenar por adelantado con `arcade_llenar_calendario(n)` para tener
-- los reels de la semana listos, pero no depende de ningún cron.
-- =====================================================

CREATE TABLE public.arcade_rounds (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id    uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  options     text[] NOT NULL CHECK (array_length(options, 1) = 4),
  odd_index   smallint NOT NULL CHECK (odd_index BETWEEN 0 AND 3),
  explanation text NOT NULL CHECK (length(explanation) > 0),
  difficulty  smallint NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
  -- 'year' pinta las opciones con la tipografía de marca (son años).
  kind        text NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'year')),
  status      text NOT NULL DEFAULT 'borrador'
              CHECK (status IN ('borrador', 'aprobada', 'rechazada')),
  source      text NOT NULL DEFAULT 'claude',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_id, options)
);

CREATE INDEX idx_arcade_rounds_status ON public.arcade_rounds(status);

CREATE TABLE public.arcade_challenges (
  challenge_date date PRIMARY KEY,
  -- El "#12" del reto. Sale de la fecha, no de un contador: así llenar el
  -- calendario fuera de orden no desordena la numeración.
  number         integer NOT NULL UNIQUE,
  round_ids      uuid[] NOT NULL CHECK (array_length(round_ids, 1) = 5),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.arcade_plays (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  challenge_date date NOT NULL REFERENCES public.arcade_challenges(challenge_date) ON DELETE CASCADE,
  -- Id generado en el navegador, sin registro. Una partida por navegador por día.
  anon_id        text NOT NULL CHECK (length(anon_id) BETWEEN 8 AND 64),
  results        boolean[] NOT NULL CHECK (array_length(results, 1) = 5),
  picks          smallint[] NOT NULL CHECK (array_length(picks, 1) = 5
                                            AND picks <@ ARRAY[0, 1, 2, 3]::smallint[]),
  score          smallint NOT NULL CHECK (score BETWEEN 0 AND 5),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_date, anon_id)
);

ALTER TABLE public.arcade_rounds     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arcade_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arcade_plays      ENABLE ROW LEVEL SECURITY;

-- Solo admins, para el futuro panel de revisión. Nada para anon.
CREATE POLICY "arcade_rounds_admin" ON public.arcade_rounds
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "arcade_challenges_admin" ON public.arcade_challenges
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "arcade_plays_admin" ON public.arcade_plays
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- ─────────────────────────────────────────────────────────────────────
-- Fecha de hoy en la Ciudad de México.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.arcade_hoy()
RETURNS date
LANGUAGE sql STABLE
SET search_path = ''
AS $$ SELECT (now() AT TIME ZONE 'America/Mexico_City')::date $$;

-- ─────────────────────────────────────────────────────────────────────
-- Arma el reto de un día con el banco. Idempotente: si ya existe, no toca nada.
--
-- Reglas: 5 rondas aprobadas, de 5 temas distintos, ordenadas de fácil a
-- difícil, sin repetir ninguna usada 180 días antes o después. Si el banco
-- no alcanza, relaja la ventana a 30 días y después a ninguna; si ni así hay
-- 5, devuelve false.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.arcade_armar_reto(p_date date)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ids    uuid[];
  v_window int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.arcade_challenges WHERE challenge_date = p_date) THEN
    RETURN true;
  END IF;

  FOREACH v_window IN ARRAY ARRAY[180, 30, 0] LOOP
    WITH usadas AS (
      SELECT unnest(c.round_ids) AS id
      FROM public.arcade_challenges c
      WHERE v_window > 0
        AND c.challenge_date BETWEEN p_date - v_window AND p_date + v_window
    ),
    -- Temas del día anterior: que dos días seguidos no abran con el mismo tema.
    temas_ayer AS (
      SELECT r.topic_id
      FROM public.arcade_challenges c
      JOIN public.arcade_rounds r ON r.id = ANY (c.round_ids)
      WHERE c.challenge_date = p_date - 1
    ),
    candidatas AS (
      SELECT DISTINCT ON (r.topic_id) r.id, r.topic_id, r.difficulty
      FROM public.arcade_rounds r
      WHERE r.status = 'aprobada'
        AND r.id NOT IN (SELECT id FROM usadas)
      ORDER BY r.topic_id, random()
    ),
    elegidas AS (
      SELECT id, difficulty
      FROM candidatas
      ORDER BY (topic_id IN (SELECT topic_id FROM temas_ayer)), random()
      LIMIT 5
    )
    SELECT array_agg(id ORDER BY difficulty, random()) INTO v_ids FROM elegidas;

    EXIT WHEN coalesce(array_length(v_ids, 1), 0) = 5;
  END LOOP;

  IF coalesce(array_length(v_ids, 1), 0) < 5 THEN
    RETURN false;
  END IF;

  INSERT INTO public.arcade_challenges (challenge_date, number, round_ids)
  VALUES (p_date, p_date - DATE '2026-09-28', v_ids)
  ON CONFLICT (challenge_date) DO NOTHING;

  RETURN true;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- Llena los próximos N días (incluido hoy). Para dejar lista la semana de
-- reels. Devuelve cuántos días quedaron con reto.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.arcade_llenar_calendario(p_dias int DEFAULT 14)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hoy date := public.arcade_hoy();
  v_ok  int := 0;
  i     int;
BEGIN
  FOR i IN 0 .. greatest(p_dias, 1) - 1 LOOP
    IF public.arcade_armar_reto(v_hoy + i) THEN
      v_ok := v_ok + 1;
    END IF;
  END LOOP;
  RETURN v_ok;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- El reto de hoy, listo para pintar. Nunca uno futuro.
-- Si hoy no existe y no se puede armar, el más reciente.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.arcade_reto()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hoy date := public.arcade_hoy();
  v_c   public.arcade_challenges;
BEGIN
  PERFORM public.arcade_armar_reto(v_hoy);

  SELECT * INTO v_c
  FROM public.arcade_challenges
  WHERE challenge_date <= v_hoy
  ORDER BY challenge_date DESC
  LIMIT 1;

  IF v_c IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'date',   v_c.challenge_date,
    'number', v_c.number,
    'rounds', (
      SELECT jsonb_agg(jsonb_build_object(
               'id',          r.id,
               'options',     to_jsonb(r.options),
               'odd',         r.odd_index,
               'explanation', r.explanation,
               'kind',        r.kind,
               'topic',       t.name,
               'topic_slug',  t.slug,
               'subject_slug', s.slug,
               'horde_ready', t.horde_ready AND t.published
             ) ORDER BY u.ord)
      FROM unnest(v_c.round_ids) WITH ORDINALITY AS u(id, ord)
      JOIN public.arcade_rounds r ON r.id = u.id
      JOIN public.topics t        ON t.id = r.topic_id
      JOIN public.subjects s      ON s.id = t.subject_id
    )
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- Cifras de un día: jugadores, promedio, % de acierto por ronda y
-- distribución de puntajes. Alimenta la pantalla final y el "solo el X%
-- acertó" de los reels.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.arcade_cifras(p_date date)
RETURNS jsonb
LANGUAGE sql STABLE
SECURITY DEFINER
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
        LEFT JOIN public.arcade_plays p ON p.challenge_date = p_date
        GROUP BY i
      ) x
    ),
    'dist', (
      SELECT jsonb_agg(n ORDER BY s)
      FROM (
        SELECT s, (SELECT count(*) FROM public.arcade_plays p
                   WHERE p.challenge_date = p_date AND p.score = s) AS n
        FROM generate_series(0, 5) AS s
      ) y
    )
  )
  FROM public.arcade_plays
  WHERE challenge_date = p_date;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- Registra una partida y devuelve las cifras del día. Idempotente por
-- (día, navegador): repetirla no cuenta doble, solo vuelve a leer cifras.
--
-- Los resultados se recalculan aquí con las `picks` contra `odd_index`: el
-- cliente manda qué tocó, no si acertó.
-- Solo acepta el reto de hoy o el de ayer (quien empezó a las 23:59).
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.arcade_registrar(
  p_date    date,
  p_anon_id text,
  p_picks   smallint[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hoy     date := public.arcade_hoy();
  v_results boolean[];
BEGIN
  IF p_date NOT IN (v_hoy, v_hoy - 1)
     OR coalesce(array_length(p_picks, 1), 0) <> 5
     OR NOT (p_picks <@ ARRAY[0, 1, 2, 3]::smallint[])
     OR length(coalesce(p_anon_id, '')) NOT BETWEEN 8 AND 64 THEN
    RETURN NULL;
  END IF;

  SELECT array_agg(p_picks[u.ord::int] = r.odd_index ORDER BY u.ord) INTO v_results
  FROM public.arcade_challenges c
  CROSS JOIN LATERAL unnest(c.round_ids) WITH ORDINALITY AS u(id, ord)
  JOIN public.arcade_rounds r ON r.id = u.id
  WHERE c.challenge_date = p_date;

  IF v_results IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.arcade_plays (challenge_date, anon_id, results, picks, score)
  VALUES (
    p_date, p_anon_id, v_results, p_picks,
    (SELECT count(*) FROM unnest(v_results) AS x WHERE x)
  )
  ON CONFLICT (challenge_date, anon_id) DO NOTHING;

  RETURN public.arcade_cifras(p_date);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.arcade_armar_reto(date)             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.arcade_llenar_calendario(int)       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.arcade_reto()                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.arcade_cifras(date)                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.arcade_registrar(date, text, smallint[]) FROM PUBLIC, anon, authenticated;
