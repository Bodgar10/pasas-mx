-- =====================================================
-- 052 · Medición de los juegos gratis en la base (no solo en PostHog)
-- Pasas.mx · Arcade + Horda pública
--
-- PostHog solo ve a quien acepta cookies de analítica. Estas filas cuentan
-- a TODOS los que juegan, sin datos personales: el único identificador es
-- el id anónimo que el navegador genera (el mismo del Arcade).
--
--   arcade_plays.origen      por dónde llegó quien terminó el reto.
--   horda_publica_avance     una fila por navegador y tema: cuántas veces
--                            empezó, oleada máxima superada (1–3), si llegó
--                            al muro y qué eligió ahí.
--
-- Mismo esquema que la 051: RLS sin políticas para anon; se escribe solo
-- por funciones SECURITY DEFINER que llama el servidor con service role.
-- =====================================================

ALTER TABLE public.arcade_plays
  ADD COLUMN IF NOT EXISTS origen text
  CHECK (origen IN ('landing_banner', 'resultado_compartido', 'arcade', 'directo'));

CREATE TABLE IF NOT EXISTS public.horda_publica_avance (
  anon_id     text NOT NULL CHECK (length(anon_id) BETWEEN 8 AND 64),
  topic_id    uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  partidas    integer NOT NULL DEFAULT 0,
  oleada_max  smallint NOT NULL DEFAULT 0 CHECK (oleada_max BETWEEN 0 AND 3),
  llego_muro  boolean NOT NULL DEFAULT false,
  eleccion    text CHECK (eleccion IN ('estudiante', 'adulto')),
  origen      text CHECK (origen IN ('landing_banner', 'resultado_compartido', 'arcade', 'directo')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (anon_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_horda_publica_avance_updated ON public.horda_publica_avance(updated_at);

ALTER TABLE public.horda_publica_avance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "horda_publica_avance_admin" ON public.horda_publica_avance
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- ─────────────────────────────────────────────────────────────────────
-- Avance de la Horda pública. p_evento:
--   'inicio'   empezó una partida (partidas + 1)
--   'oleada'   superó la oleada p_oleada (1–3); 3 = llegó al muro
--   'eleccion' en el muro eligió p_eleccion ('estudiante' | 'adulto')
-- El origen se fija la primera vez y no se pisa.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.horda_publica_registrar(
  p_anon_id  text,
  p_topic_id uuid,
  p_evento   text,
  p_oleada   int  DEFAULT NULL,
  p_eleccion text DEFAULT NULL,
  p_origen   text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_origen text := CASE WHEN p_origen IN ('landing_banner', 'resultado_compartido', 'arcade', 'directo') THEN p_origen END;
BEGIN
  IF length(coalesce(p_anon_id, '')) NOT BETWEEN 8 AND 64
     OR p_evento NOT IN ('inicio', 'oleada', 'eleccion')
     OR (p_evento = 'oleada' AND (p_oleada IS NULL OR p_oleada NOT BETWEEN 1 AND 3))
     OR (p_evento = 'eleccion' AND p_eleccion NOT IN ('estudiante', 'adulto')) THEN
    RETURN false;
  END IF;

  INSERT INTO public.horda_publica_avance AS a (anon_id, topic_id, partidas, oleada_max, llego_muro, eleccion, origen)
  VALUES (
    p_anon_id, p_topic_id,
    CASE WHEN p_evento = 'inicio' THEN 1 ELSE 0 END,
    CASE WHEN p_evento = 'oleada' THEN p_oleada ELSE 0 END,
    p_evento = 'oleada' AND p_oleada >= 3,
    CASE WHEN p_evento = 'eleccion' THEN p_eleccion END,
    v_origen
  )
  ON CONFLICT (anon_id, topic_id) DO UPDATE SET
    partidas   = a.partidas + CASE WHEN p_evento = 'inicio' THEN 1 ELSE 0 END,
    oleada_max = greatest(a.oleada_max, CASE WHEN p_evento = 'oleada' THEN p_oleada ELSE 0 END),
    llego_muro = a.llego_muro OR (p_evento = 'oleada' AND p_oleada >= 3),
    eleccion   = coalesce(CASE WHEN p_evento = 'eleccion' THEN p_eleccion END, a.eleccion),
    origen     = coalesce(a.origen, v_origen),
    updated_at = now();

  RETURN true;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- arcade_registrar con origen. Se reemplaza la de la 051: el parámetro
-- nuevo tiene DEFAULT, así que el código que la llama con tres argumentos
-- nombrados sigue funcionando mientras llega el deploy.
-- ─────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.arcade_registrar(date, text, smallint[]);

CREATE OR REPLACE FUNCTION public.arcade_registrar(
  p_date    date,
  p_anon_id text,
  p_picks   smallint[],
  p_origen  text DEFAULT NULL
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

  INSERT INTO public.arcade_plays (challenge_date, anon_id, results, picks, score, origen)
  VALUES (
    p_date, p_anon_id, v_results, p_picks,
    (SELECT count(*) FROM unnest(v_results) AS x WHERE x),
    v_origen
  )
  ON CONFLICT (challenge_date, anon_id) DO NOTHING;

  RETURN public.arcade_cifras(p_date);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.arcade_registrar(date, text, smallint[], text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.horda_publica_registrar(text, uuid, text, int, text, text) FROM PUBLIC, anon, authenticated;
