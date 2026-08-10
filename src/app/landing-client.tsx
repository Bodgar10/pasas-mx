'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { detectAudience } from '@/lib/audience-detection'
import { COLORS, FONTS, RADIUS } from '@/lib/design-tokens'
import { PLAN_DISPLAY } from '@/lib/payments/config'
import { FEATURE_FLAGS } from '@/lib/feature-flags'
import WhatsAppButton from '@/components/global/WhatsAppButton'
import Logo from '@/components/global/Logo'
import Image from 'next/image'
import DemoPistas from '@/components/landing/DemoPistas'
import DemoHorda from '@/components/landing/DemoHorda'
import Pasita from '@/components/mascota/Pasita'
import PasitaLazy from '@/components/mascota/PasitaLazy'
import { createClient } from '@/utils/supabase/client'

// ── A/B hero variants ──────────────────────────────────────────────
const HERO_VARIANTS = {
  D: {
    id: 'D',
    h1: 'Estudia sin estudiar.',
    sub: 'Secundaria y prepa completas, convertidas en minijuegos. Con la temática que ya te gusta.',
    cta: 'Probar una semana gratis →',
    micro: '7 días gratis · Cancela cuando quieras.',
  },
  E: {
    id: 'E',
    h1: 'No es para todos.\nEs para ti.',
    sub: 'Si en clase te aburres pero en TikTok te clavas tres horas, no eres tú: es el método. Cámbialo.',
    cta: 'Quiero entrar →',
    micro: '7 días gratis. Si no es lo tuyo, cancelas y ya.',
  },
  PAPA: {
    id: 'PAPA',
    h1: 'Tu hijo no es flojo.\nLa escuela no le habla en su idioma.',
    sub: 'Pasas.mx explica cada materia con lo que ya le gusta: Minecraft, anime, K-pop o fútbol. Deja de pelear por las tareas.',
    cta: 'Prueba 7 días gratis →',
    micro: '7 días gratis · Sin contrato · Cancela cuando quieras.',
  },
} as const

type VariantKey = keyof typeof HERO_VARIANTS

function getOrAssignVariant(): VariantKey {
  if (typeof window === 'undefined') return 'D'
  const stored = localStorage.getItem('pasas_hero_variant') as VariantKey | null
  if (stored === 'D' || stored === 'E') return stored
  const assigned: VariantKey = Math.random() < 0.5 ? 'D' : 'E'
  localStorage.setItem('pasas_hero_variant', assigned)
  return assigned
}

// ── Intersection Observer hook ─────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); obs.disconnect() }
    }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}

// ── Data ───────────────────────────────────────────────────────────
// Conteos reales de la base, medidos el 4 ago 2026. NO inventar cifras aquí.
const MINIJUEGOS = [
  { emoji: '🃏', title: 'Memorama',        desc: 'Empareja la regla con su caso. Suena fácil hasta que lo intentas.',           dato: '1,436 partidas' },
  { emoji: '🎚️', title: 'Mueve la barrita', desc: 'Cambia un valor y mira cómo se mueve todo lo demás. Entiendes antes de que te expliquen.', dato: '1,073 simuladores' },
  { emoji: '🧩', title: 'Ordena los pasos', desc: 'Un toque, un paso. El problema completo, en orden.',                          dato: '2,051 secuencias' },
  { emoji: '🔀', title: 'Clasifica',        desc: 'Arrastra cada cosa a donde va. Si te equivocas, lo ves al instante.',        dato: '2,328 ejercicios' },
  { emoji: '🎧', title: 'Escúchalo',        desc: 'Todo tiene audio. Estúdialo en el camión si quieres.',                        dato: '4,070 audios' },
]

const THEMES = [
  { emoji: '🎮', name: 'Videojuegos', color: COLORS.primary, desc: 'Mate con Minecraft. Física con Free Fire. Programación con Roblox. Si ya le metes horas, que cuenten para algo.' },
  { emoji: '🎤', name: 'K-pop', color: COLORS.pink, desc: 'Historia, geografía e inglés con BTS, Stray Kids y NewJeans. Aprende coreano de paso, sin querer queriendo.' },
  { emoji: '⚔️', name: 'Anime', color: COLORS.cyan, desc: 'Filosofía con Death Note. Historia con Demon Slayer. Biología con Cells at Work. Sí, es real.' },
  { emoji: '⚽', name: 'Fútbol', color: COLORS.success, desc: 'Estadística con la Liga MX. Geografía con el Mundial. Inglés con Premier League. Para los que sí ven los 90 minutos.' },
]

/**
 * Capturas REALES, una por temática.
 *
 * Antes había cuatro pestañas mostrando las mismas cuatro imágenes con distinto
 * pie de foto. Quien picaba dos se daba cuenta.
 *
 * Fútbol y Anime vuelven cuando existan sus capturas. Prefiero dos pestañas
 * verdaderas que cuatro repetidas.
 */
const THEME_TABS = [
  {
    id: 'gaming',
    emoji: '🎮',
    label: 'Videojuegos',
    screens: [
      { src: '/screenshots/gaming-dashboard.png',   caption: 'Tu XP, tu racha y tus materias' },
      { src: '/screenshots/gaming-interactivo.png', caption: 'Álgebra explicada con Genshin Impact' },
      { src: '/screenshots/gaming-pistas.png',      caption: 'Papel y lápiz: fallas y salen las pistas' },
      { src: '/screenshots/gaming-horda.png',       caption: 'Modo Horda: 6 oleadas de preguntas' },
    ],
  },
  {
    id: 'kpop',
    emoji: '🎤',
    label: 'K-pop',
    screens: [
      { src: '/screenshots/kpop-dashboard.png',   caption: 'Tu XP, tu racha y tus materias' },
      { src: '/screenshots/kpop-interactivo.png', caption: 'Las revoluciones explicadas con SEVENTEEN' },
      { src: '/screenshots/kpop-pistas.png',      caption: 'Clasifica: arrastra y comprueba' },
      { src: '/screenshots/kpop-horda.png',       caption: 'Modo Horda: 6 oleadas de preguntas' },
    ],
  },
]

const TUTORIAL_STANDARD = [
  { emoji: '🎮', step: '01', title: 'Elige tu temática', desc: 'Una sola: Videojuegos, K-pop, Anime o Fútbol. Todo tu contenido se genera dentro de ese mundo.' },
  { emoji: '📚', step: '02', title: 'Elige tu grado', desc: 'Secundaria o prepa, el grado que cursas. El temario completo de todas tus materias te espera.' },
  { emoji: '⚡', step: '03', title: 'Aprende con lo que ya te gusta', desc: 'Cada lección, ejemplo y quiz usa tu temática. Matemáticas con Minecraft. Historia con Anime. Siempre.' },
  { emoji: '🏆', step: '04', title: 'Sube de nivel', desc: 'Gana XP, mantén tu racha diaria y desbloquea contenido. El progreso se siente porque se ve.' },
]

const TUTORIAL_PERSONALIZED = [
  { emoji: '🎯', step: '01', title: 'Elige la materia que te cuesta', desc: 'Solo una. La que más te pesa, la que vas a reprobar, la que no entiendes por nada.' },
  { emoji: '🧠', step: '02', title: 'Haz el diagnóstico', desc: 'Un quiz corto detecta exactamente dónde están tus huecos. No adivinamos — medimos.' },
  { emoji: '✨', step: '03', title: 'Tu guía se genera solo para ti', desc: 'Con tu temática, tus puntos débiles y tu nivel. No es un temario genérico — es tuyo.' },
  { emoji: '📈', step: '04', title: 'Avanza más rápido', desc: 'Sin perder tiempo en lo que ya sabes. El plan personalizado va directo a lo que necesitas.' },
]

const PLANS = [
  {
    name: 'Estándar',
    price: `$${PLAN_DISPLAY.estandar_v2.prices.mensual.amount}`,
    period: 'al mes',
    badge: null,
    color: COLORS.primary,
    description: 'Todo el contenido gamificado con la temática que elijas.',
    features: [
      '🎮 Eliges 1 temática: Videojuegos, K-pop, Anime o Fútbol',
      '📚 Todas las materias de tu grado',
      '⚡ XP, rachas y sistema de niveles',
      '📊 Progreso por tema en tiempo real',
      '❌ Sin contrato · Cancela cuando quieras',
    ],
    cta: 'Empezar gratis →',
    note: '7 días gratis · Requiere tarjeta · Cancela cuando quieras.',
    // Si el Personalizado está oculto, el Estándar es la única tarjeta:
    // se destaca para que su CTA no quede como botón fantasma.
    highlight: !FEATURE_FLAGS.ENABLE_PERSONALIZED_PLAN,
  },
  ...(FEATURE_FLAGS.ENABLE_PERSONALIZED_PLAN ? [{
    name: 'Personalizado',
    price: `$${PLAN_DISPLAY.personalizado_v2.prices.mensual.amount}`,
    period: 'al mes',
    badge: '⚡ Recomendado',
    color: COLORS.pink,
    description: 'Para cuando hay UNA materia que te está matando y necesitas ir directo a lo que no entiendes.',
    features: [
      '✅ Todo lo del plan Estándar',
      '🧠 Diagnóstico inicial de conocimientos',
      '🎯 Plan generado solo para ti',
      '🔄 Contenido que se adapta a tus errores',
      '📈 Avance más rápido, menos tiempo perdido',
    ],
    cta: 'Quiero el personalizado →',
    note: '7 días gratis · Requiere tarjeta · Cancela cuando quieras.',
    highlight: true,
  }] : []),
]

/**
 * CTA intermedio. Morado sólido, un escalón por debajo del hero y el cierre,
 * que llevan degradado a rosa y resplandor.
 *
 * Se probó primero con solo borde y se descartó: a media página, sin relleno,
 * no se leía como una invitación — pasaba desapercibido.
 *
 * Si los cuatro botones de la página pesaran igual, se leería como un anuncio
 * y el del final —el que cierra— perdería su condición de remate. Estos dos
 * solo están para que quien ya se convenció a media página no tenga que
 * seguir bajando ni volver arriba.
 *
 * 🔴 Cada uno con su propio `location`: es lo que permite ver en PostHog cuál
 * argumento convence. Si el de después de las demos gana, eso dice que lo
 * jugable es lo que vende.
 */
function CTAIntermedio({
  texto,
  location,
  onClick,
}: {
  texto: string
  location: string
  onClick: (location: string) => void
}) {
  return (
    <div style={{ padding: '0 24px 64px', maxWidth: 520, margin: '0 auto' }}>
      <Link
        href="/onboarding"
        prefetch={true}
        onClick={() => onClick(location)}
        style={{
          background: COLORS.primary,
          border: 'none',
          color: '#fff',
          borderRadius: RADIUS.xl,
          padding: '16px 24px',
          fontFamily: FONTS.nunito,
          fontWeight: 900,
          fontSize: 16,
          cursor: 'pointer',
          width: '100%',
          minHeight: 54,
          // Sombra suave, no el resplandor de 32px de los CTAs principales:
          // se lee como botón sin quitarle el remate al del cierre.
          boxShadow: `0 4px 20px ${COLORS.primary}44`,
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
      >
        {texto}
      </Link>
      <p style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: COLORS.muted, opacity: 0.55 }}>
        7 días gratis · Cancela cuando quieras
      </p>
    </div>
  )
}

// ── Section wrapper with fade-in ───────────────────────────────────
function FadeSection({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const { ref, inView } = useInView()
  return (
    <div
      ref={ref}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(32px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────
export default function LandingClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [variant, setVariant] = useState<VariantKey>('D')
  const [scrolled, setScrolled] = useState(false)
  const [activeTab, setActiveTab] = useState('gaming')

  function track(event: string, props?: Record<string, any>) {
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.capture(event, props)
    }
  }

  useEffect(() => {
    // Track time on page
    const start = Date.now()
    return () => {
      const seconds = Math.round((Date.now() - start) / 1000)
      track('landing_exit', { seconds_on_page: seconds })
    }
  }, [])

  useEffect(() => {
    // Track scroll depth
    const checkpoints = [25, 50, 75, 100]
    const reached = new Set<number>()
    const onScroll = () => {
      const scrolled = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100)
      checkpoints.forEach(cp => {
        if (scrolled >= cp && !reached.has(cp)) {
          reached.add(cp)
          track('landing_scroll_depth', { percent: cp })
        }
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    // Si hay utm_source, detectar audiencia y mostrar hero correspondiente
    const utmSource = searchParams.get('utm_source')
    const audience = detectAudience(utmSource)

    let v: VariantKey
    if (audience === 'papa') {
      v = 'PAPA'
    } else {
      v = getOrAssignVariant()
    }

    setVariant(v)
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.capture('hero_variant_seen', { variant: v, audience, utm_source: utmSource })
    }

    // Prefetch anonymous session in background while user reads the landing
    // So when they tap CTA, the session already exists and onboarding loads instantly
    const prefetchSession = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          await supabase.auth.signInAnonymously()
        }
      } catch {
        // Silent fail — if it fails, onboarding/page.tsx handles it as fallback
      }
    }

    // Delay 2s so it doesn't compete with the initial page render
    const timer = setTimeout(prefetchSession, 2000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const hero = HERO_VARIANTS[variant]

  function handleCTA(location: string) {
    track('hero_variant_converted', { variant, cta_location: location })
    track('landing_cta_clicked', { location, variant })
    localStorage.setItem('pasas_trial_used', 'true')
  }

  return (
    <div style={{ fontFamily: FONTS.nunito, color: COLORS.text, minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── Sticky nav ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '0 20px',
        height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(15,10,30,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? `1px solid ${COLORS.inputBorder}` : 'none',
        transition: 'background 0.3s ease, border 0.3s ease',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Logo size={24} />
          <span style={{ fontFamily: FONTS.orbitron, fontWeight: 900, fontSize: 18, color: COLORS.text, letterSpacing: 2 }}>
            PASAS.MX
          </span>
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            href="/login"
            prefetch={true}
            onClick={() => track('landing_login_clicked', { location: 'nav' })}
            style={{ background: 'transparent', border: `1.5px solid ${COLORS.inputBorder}`, color: COLORS.muted, borderRadius: RADIUS.lg, padding: '8px 16px', fontFamily: FONTS.nunito, fontWeight: 700, fontSize: 14, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >
            Entrar
          </Link>
          <Link
            href="/onboarding"
            prefetch={true}
            onClick={() => handleCTA('nav')}
            style={{ background: COLORS.primary, border: 'none', color: '#fff', borderRadius: RADIUS.lg, padding: '8px 16px', fontFamily: FONTS.nunito, fontWeight: 900, fontSize: 14, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >
            Gratis →
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ minHeight: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 24px 64px', textAlign: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 320, height: 320, background: `radial-gradient(circle, ${COLORS.primary}33 0%, transparent 70%)`, pointerEvents: 'none', filter: 'blur(40px)' }} />
        <div style={{ animation: 'fadeUp 0.8s ease both', position: 'relative', maxWidth: 480 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${COLORS.primary}22`, border: `1px solid ${COLORS.primary}55`, borderRadius: RADIUS.pill, padding: '6px 14px', marginBottom: 24 }}>
            <span style={{ fontSize: 12 }}>✨</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.muted }}>Ya está en línea · Entra gratis hoy</span>
          </div>
          <h1 style={{ fontFamily: FONTS.orbitron, fontWeight: 900, fontSize: 'clamp(28px, 8vw, 42px)', lineHeight: 1.15, marginBottom: 20, whiteSpace: 'pre-line', background: `linear-gradient(135deg, ${COLORS.text} 0%, ${COLORS.muted} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {hero.h1}
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.6, color: COLORS.muted, marginBottom: 24, fontWeight: 600 }}>
            {hero.sub}
          </p>

          {/* La Pasita presentándose.
              Va con <Pasita> y no con <PasitaLazy>: está por encima del pliegue
              y diferirla la haría aparecer con retraso, justo donde el visitante
              está mirando. Es la única de la landing que se carga de entrada.
              'flotar' es lento y sutil — a esta altura de la página compite con
              el CTA si se mueve demasiado. */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <Pasita pose="confiada" size={140} animacion="flotar" />
          </div>

          <Link
            href="/onboarding"
            prefetch={true}
            onClick={() => handleCTA('hero')}
            style={{ background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.pink})`, border: 'none', color: '#fff', borderRadius: RADIUS.xl, padding: '16px 32px', fontFamily: FONTS.nunito, fontWeight: 900, fontSize: 17, cursor: 'pointer', width: '100%', maxWidth: 360, minHeight: 52, boxShadow: `0 0 32px ${COLORS.primary}55`, transition: 'transform 0.15s ease, box-shadow 0.15s ease', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {hero.cta}
          </Link>
          <p style={{ marginTop: 12, fontSize: 13, color: COLORS.muted, opacity: 0.7 }}>{hero.micro}</p>
          <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: 0.4 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>scroll</span>
            <div style={{ width: 1, height: 40, background: `linear-gradient(to bottom, ${COLORS.muted}, transparent)` }} />
          </div>
        </div>
      </section>

      {/* ── AQUÍ NO TE QUEDAS ATORADO — el argumento insustituible ── */}
      <FadeSection>
        <section style={{ padding: '72px 24px', maxWidth: 520, margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 800, letterSpacing: 3, color: COLORS.primary, textTransform: 'uppercase', marginBottom: 8 }}>Papel y lápiz</p>
          {/* La pose del lápiz existe exactamente para esta sección. */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <PasitaLazy pose="lapiz" size={110} />
          </div>

          <h2 style={{ fontFamily: FONTS.orbitron, fontWeight: 900, fontSize: 'clamp(22px, 6vw, 30px)', textAlign: 'center', marginBottom: 12, color: COLORS.text }}>
            Aquí no te quedas atorado.
          </h2>
          <p style={{ textAlign: 'center', fontSize: 15, color: COLORS.muted, marginBottom: 32, lineHeight: 1.6, fontWeight: 600 }}>
            Escribes tu respuesta. Si está mal, no te dice “incorrecto” y ya:
            te suelta una pista. ¿Sigues sin salir? Otra. Hasta que lo sacas tú.
          </p>

          <DemoPistas onIntento={() => track('landing_demo_pistas')} />

          <p style={{ textAlign: 'center', fontSize: 13, color: COLORS.muted, marginTop: 14, opacity: 0.7 }}>
            676 ejercicios así en matemáticas, con hasta 8 pistas cada uno.
          </p>
        </section>
      </FadeSection>

      {/* ── MODO HORDA ── */}
      <FadeSection>
        <section style={{ padding: '72px 24px', maxWidth: 520, margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 800, letterSpacing: 3, color: COLORS.pink, textTransform: 'uppercase', marginBottom: 8 }}>Modo Horda</p>
          {/* La zombie: cicatriz, tornillos y lengua fuera. Cuenta de qué va
              el Modo Horda antes de leer una sola palabra. */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <PasitaLazy pose="zombie" size={110} animacion="flotar" />
          </div>

          <h2 style={{ fontFamily: FONTS.orbitron, fontWeight: 900, fontSize: 'clamp(22px, 6vw, 30px)', textAlign: 'center', marginBottom: 12, color: COLORS.text }}>
            ¿Examen el viernes?
          </h2>
          <p style={{ textAlign: 'center', fontSize: 15, color: COLORS.muted, marginBottom: 32, lineHeight: 1.6, fontWeight: 600 }}>
            30 preguntas en 6 oleadas, cada una más difícil que la anterior.
            Si fallas, te dice el truco para que no se te olvide.
          </p>

          <DemoHorda onAvanzar={() => track('landing_demo_horda')} />

          <p style={{ textAlign: 'center', fontSize: 13, color: COLORS.muted, marginTop: 14, opacity: 0.7 }}>
            17,370 preguntas en los 579 temas. Secundaria y prepa completas.
          </p>
        </section>
      </FadeSection>

      {/* Justo después de las dos demos jugables: ya probó el producto. */}
      <FadeSection>
        <CTAIntermedio
          texto="Ya lo probaste. Entra gratis →"
          location="post_demos"
          onClick={handleCTA}
        />
      </FadeSection>

      {/* ── NO ES LEER, ES JUGAR ── */}
      <FadeSection>
        <section style={{ padding: '72px 24px', maxWidth: 520, margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 800, letterSpacing: 3, color: COLORS.cyan, textTransform: 'uppercase', marginBottom: 8 }}>Dentro de cada tema</p>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <PasitaLazy pose="celebrando" size={110} />
          </div>

          <h2 style={{ fontFamily: FONTS.orbitron, fontWeight: 900, fontSize: 'clamp(22px, 6vw, 30px)', textAlign: 'center', marginBottom: 12, color: COLORS.text }}>
            No es leer. Es jugar.
          </h2>
          <p style={{ textAlign: 'center', fontSize: 15, color: COLORS.muted, marginBottom: 40, lineHeight: 1.6, fontWeight: 600 }}>
            579 temas de secundaria y prepa, cada uno con estos.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {MINIJUEGOS.map((j, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', background: COLORS.card, borderRadius: RADIUS.xxl, padding: '20px', border: `1px solid ${COLORS.inputBorder}` }}>
                <div style={{ minWidth: 48, height: 48, borderRadius: RADIUS.xl, background: `${COLORS.primary}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                  {j.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <p style={{ fontWeight: 800, fontSize: 16, color: COLORS.text }}>{j.title}</p>
                    <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.primary, opacity: 0.9 }}>{j.dato}</span>
                  </div>
                  <p style={{ fontSize: 14, color: COLORS.muted, lineHeight: 1.6 }}>{j.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </FadeSection>

      {/* ── TEMÁTICAS ── */}
      <FadeSection>
        <section style={{ padding: '72px 24px', maxWidth: 520, margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 800, letterSpacing: 3, color: COLORS.pink, textTransform: 'uppercase', marginBottom: 8 }}>Temáticas</p>
          <h2 style={{ fontFamily: FONTS.orbitron, fontWeight: 900, fontSize: 'clamp(22px, 6vw, 30px)', textAlign: 'center', marginBottom: 48, color: COLORS.text }}>
            Escoge tu mundo.
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {THEMES.map((t, i) => (
              <div key={i} style={{ background: COLORS.card, borderRadius: RADIUS.xxl, padding: '20px', border: `1px solid ${t.color}33`, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: t.color, borderRadius: '4px 0 0 4px' }} />
                <div style={{ paddingLeft: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 24 }}>{t.emoji}</span>
                    <span style={{ fontFamily: FONTS.orbitron, fontWeight: 900, fontSize: 14, color: t.color }}>{t.name}</span>
                  </div>
                  <p style={{ fontSize: 14, color: COLORS.muted, lineHeight: 1.6 }}>{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </FadeSection>

      {/* ── ASÍ SE VE POR DENTRO ── */}
      <FadeSection>
        <section style={{ padding: '72px 0', maxWidth: 520, margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 800, letterSpacing: 3, color: COLORS.pink, textTransform: 'uppercase', marginBottom: 8, padding: '0 24px' }}>Vista previa</p>
          <h2 style={{ fontFamily: FONTS.orbitron, fontWeight: 900, fontSize: 'clamp(22px, 6vw, 30px)', textAlign: 'center', marginBottom: 12, color: COLORS.text, padding: '0 24px' }}>
            Así se ve por dentro.
          </h2>
          <p style={{ textAlign: 'center', fontSize: 15, color: COLORS.muted, marginBottom: 32, lineHeight: 1.6, fontWeight: 600, padding: '0 24px' }}>
            Capturas reales de la plataforma. Dos temáticas, el mismo temario.
          </p>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, padding: '0 24px', marginBottom: 32, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {THEME_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); track('landing_theme_tab_clicked', { theme: tab.id }) }}
                style={{
                  background: activeTab === tab.id ? COLORS.primary : `${COLORS.primary}18`,
                  border: `1.5px solid ${activeTab === tab.id ? COLORS.primary : COLORS.inputBorder}`,
                  color: activeTab === tab.id ? '#fff' : COLORS.muted,
                  borderRadius: RADIUS.pill,
                  padding: '8px 16px',
                  fontFamily: FONTS.nunito,
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                  flexShrink: 0,
                }}
              >
                {tab.emoji} {tab.label}
              </button>
            ))}
          </div>

          {/* Screenshots scroll horizontal */}
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '0 24px 16px', scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}>
            {THEME_TABS.find(t => t.id === activeTab)?.screens.map((screen, i) => (
              <div key={i} style={{ flexShrink: 0, scrollSnapAlign: 'start', width: 320 }}>
                {/* Marco de teléfono.
                    Las capturas tienen el mismo fondo #0a0a0f que la landing, así
                    que sin marco se funden con la página y no se ve dónde empieza
                    la pantalla. El borde las separa y de paso comunica que el
                    producto es móvil. */}
                <div
                  style={{
                    position: 'relative',
                    padding: 8,
                    borderRadius: 36,
                    background: 'linear-gradient(160deg, #2a2140 0%, #15102a 100%)',
                    border: `1px solid ${COLORS.primary}44`,
                    boxShadow: `0 0 0 1px rgba(0,0,0,0.6), 0 18px 40px rgba(0,0,0,0.55), 0 0 60px ${COLORS.primary}18`,
                  }}
                >
                  {/* Notch */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 14,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 86,
                      height: 20,
                      borderRadius: 999,
                      background: '#000',
                      zIndex: 2,
                    }}
                  />
                  <Image
                    src={screen.src}
                    alt={screen.caption}
                    width={320}
                    height={696}
                    style={{
                      width: '100%',
                      height: 'auto',
                      borderRadius: 28,
                      display: 'block',
                    }}
                    loading="lazy"
                  />
                </div>
                <p style={{ textAlign: 'center', fontSize: 12, color: COLORS.muted, marginTop: 14, fontWeight: 600, lineHeight: 1.4 }}>
                  {screen.caption}
                </p>
              </div>
            ))}
          </div>

          <style>{`
            div::-webkit-scrollbar { display: none; }
          `}</style>
        </section>
      </FadeSection>

      {/* Ya vio capturas reales de la plataforma: sabe exactamente qué compra. */}
      <FadeSection>
        <CTAIntermedio
          texto="Así se va a ver tu cuenta. Empieza gratis →"
          location="post_capturas"
          onClick={handleCTA}
        />
      </FadeSection>

      {/* ── TUTORIAL ── */}
      <FadeSection>
        <section style={{ padding: '72px 24px', maxWidth: 520, margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 800, letterSpacing: 3, color: COLORS.cyan, textTransform: 'uppercase', marginBottom: 8 }}>¿Cómo funciona exactamente?</p>
          <h2 style={{ fontFamily: FONTS.orbitron, fontWeight: 900, fontSize: 'clamp(22px, 6vw, 30px)', textAlign: 'center', marginBottom: 12, color: COLORS.text }}>
            {FEATURE_FLAGS.ENABLE_PERSONALIZED_PLAN ? 'Elige tu camino.' : 'Así funciona.'}
          </h2>
          <p style={{ textAlign: 'center', fontSize: 15, color: '#c4b5fd', marginBottom: 48, lineHeight: 1.6, fontWeight: 600 }}>
            {FEATURE_FLAGS.ENABLE_PERSONALIZED_PLAN
              ? 'Dos opciones según lo que necesitas.'
              : 'Cuatro pasos y ya estás dentro.'}
          </p>

          {/* Plan Estándar */}
          <div style={{ background: COLORS.card, borderRadius: RADIUS.xxl, padding: '24px 20px', border: `1.5px solid ${COLORS.primary}44`, marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.cyan})` }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 22 }}>🎮</span>
              <span style={{ fontFamily: FONTS.orbitron, fontWeight: 900, fontSize: 13, color: COLORS.primary }}>Plan Estándar — ${PLAN_DISPLAY.estandar_v2.prices.mensual.amount}/mes</span>
            </div>
            <p style={{ fontSize: 15, color: '#c4b5fd', fontWeight: 700, marginBottom: 24, lineHeight: 1.5 }}>
              Eliges UNA temática y accedes al temario completo de todas tus materias dentro de ese mundo.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {TUTORIAL_STANDARD.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 44, height: 44, borderRadius: RADIUS.lg, background: `${COLORS.primary}22`, border: `1px solid ${COLORS.primary}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                    {item.emoji}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: FONTS.orbitron, fontSize: 10, fontWeight: 900, color: COLORS.primary }}>{item.step}</span>
                      <p style={{ fontWeight: 800, fontSize: 15, color: COLORS.text }}>{item.title}</p>
                    </div>
                    <p style={{ fontSize: 14, color: '#c4b5fd', lineHeight: 1.6, fontWeight: 500 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Plan Personalizado — oculto mientras ENABLE_PERSONALIZED_PLAN sea false */}
          {FEATURE_FLAGS.ENABLE_PERSONALIZED_PLAN && (
          <div style={{ background: COLORS.card, borderRadius: RADIUS.xxl, padding: '24px 20px', border: `1.5px solid ${COLORS.pink}44`, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${COLORS.pink}, ${COLORS.primary})` }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 22 }}>✨</span>
              <span style={{ fontFamily: FONTS.orbitron, fontWeight: 900, fontSize: 13, color: COLORS.pink }}>Plan Personalizado — ${PLAN_DISPLAY.personalizado_v2.prices.mensual.amount}/mes</span>
            </div>
            <p style={{ fontSize: 15, color: '#c4b5fd', fontWeight: 700, marginBottom: 24, lineHeight: 1.5 }}>
              Eliges UNA materia, haces un diagnóstico y se genera un plan hecho solo para ti y tus puntos débiles.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {TUTORIAL_PERSONALIZED.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 44, height: 44, borderRadius: RADIUS.lg, background: `${COLORS.pink}22`, border: `1px solid ${COLORS.pink}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                    {item.emoji}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: FONTS.orbitron, fontSize: 10, fontWeight: 900, color: COLORS.pink }}>{item.step}</span>
                      <p style={{ fontWeight: 800, fontSize: 15, color: COLORS.text }}>{item.title}</p>
                    </div>
                    <p style={{ fontSize: 14, color: '#c4b5fd', lineHeight: 1.6, fontWeight: 500 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
        </section>
      </FadeSection>

      {/* ── COMUNIDAD ── */}
      <FadeSection>
        <section style={{ padding: '72px 24px', maxWidth: 520, margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 800, letterSpacing: 3, color: COLORS.cyan, textTransform: 'uppercase', marginBottom: 8 }}>Comunidad</p>
          <h2 style={{ fontFamily: FONTS.orbitron, fontWeight: 900, fontSize: 'clamp(20px, 5vw, 28px)', textAlign: 'center', marginBottom: 20, color: COLORS.text }}>
            Recién salido del horno. 🇲🇽
          </h2>
          <div style={{ background: COLORS.card, borderRadius: RADIUS.xxl, padding: '28px 24px', border: `1px solid ${COLORS.inputBorder}` }}>
            <p style={{ fontSize: 16, color: '#c4b5fd', lineHeight: 1.8, fontWeight: 600, marginBottom: 20 }}>
              No somos la plataforma con millones de usuarios. Somos la que alguien construyó porque le tocó estudiar con libros aburridos y dijo:
            </p>
            <p style={{ fontSize: 18, color: COLORS.text, lineHeight: 1.7, fontWeight: 800, marginBottom: 20, fontStyle: 'italic' }}>
              "Tiene que haber una mejor forma."
            </p>
            <p style={{ fontSize: 15, color: '#c4b5fd', lineHeight: 1.7, fontWeight: 600, marginBottom: 0 }}>
              Ya estamos en línea. Si entras ahora, eres de los primeros — y tu opinión construye la plataforma. Una semana gratis para probarlo todo.
            </p>
          </div>
        </section>
      </FadeSection>

      {/* ── PRECIOS ── */}
      <FadeSection>
        <section style={{ padding: '72px 24px', maxWidth: 520, margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 800, letterSpacing: 3, color: COLORS.yellow, textTransform: 'uppercase', marginBottom: 8 }}>Precios</p>
          <h2 style={{ fontFamily: FONTS.orbitron, fontWeight: 900, fontSize: 'clamp(22px, 6vw, 30px)', textAlign: 'center', marginBottom: 12, color: COLORS.text }}>
            ${PLAN_DISPLAY.estandar_v2.prices.mensual.amount} al mes.<br />Un maestro particular cobra eso por una hora.
          </h2>
          <p style={{ textAlign: 'center', fontSize: 14, color: COLORS.muted, marginBottom: 24, lineHeight: 1.6 }}>
            Sin contrato. Cancela cuando quieras. Sin letras chiquitas.
          </p>

          {/* Pulgar arriba sobre el precio: es donde el visitante duda. */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <PasitaLazy pose="aprobando" size={100} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {PLANS.map((plan, i) => (
              <div key={i} style={{ background: plan.highlight ? `linear-gradient(135deg, ${COLORS.card} 0%, ${COLORS.card2} 100%)` : COLORS.card, borderRadius: RADIUS.xxl, padding: '28px 24px', border: `1.5px solid ${plan.highlight ? plan.color + '66' : COLORS.inputBorder}`, position: 'relative', overflow: 'hidden' }}>
                {plan.badge && (
                  <div style={{ position: 'absolute', top: 16, right: 16, background: `${plan.color}22`, border: `1px solid ${plan.color}55`, borderRadius: RADIUS.pill, padding: '4px 12px', fontSize: 11, fontWeight: 800, color: plan.color }}>
                    {plan.badge}
                  </div>
                )}
                {plan.highlight && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.pink})` }} />
                )}
                <p style={{ fontFamily: FONTS.orbitron, fontWeight: 900, fontSize: 15, color: plan.color, marginBottom: 4 }}>{plan.name}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontFamily: FONTS.orbitron, fontWeight: 900, fontSize: 36, color: COLORS.text }}>{plan.price}</span>
                  <span style={{ fontSize: 14, color: COLORS.muted, fontWeight: 600 }}>{plan.period}</span>
                </div>
                <p style={{ fontSize: 14, color: COLORS.muted, marginBottom: 20, lineHeight: 1.5 }}>{plan.description}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                  {plan.features.map((f, j) => (
                    <p key={j} style={{ fontSize: 14, color: COLORS.text, fontWeight: 600 }}>{f}</p>
                  ))}
                </div>
                <Link
                  href="/onboarding"
                  prefetch={true}
                  onClick={() => handleCTA(`pricing_${plan.name.toLowerCase()}`)}
                  style={{ background: plan.highlight ? `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.pink})` : `${COLORS.primary}22`, border: plan.highlight ? 'none' : `1.5px solid ${COLORS.primary}55`, color: plan.highlight ? '#fff' : COLORS.primary, borderRadius: RADIUS.xl, padding: '14px 24px', fontFamily: FONTS.nunito, fontWeight: 900, fontSize: 15, cursor: 'pointer', width: '100%', minHeight: 52, transition: 'transform 0.15s ease', boxShadow: plan.highlight ? `0 0 24px ${COLORS.primary}44` : 'none', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {plan.cta}
                </Link>
                <p style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: COLORS.muted, opacity: 0.6 }}>{plan.note}</p>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: COLORS.muted, opacity: 0.5 }}>
            ¿Quieres pagar 3 o 6 meses?{' '}
            <span onClick={() => { track('landing_ver_planes_clicked'); router.push('/planes') }} style={{ color: COLORS.primary, cursor: 'pointer', fontWeight: 700 }}>
              Ver todos los planes →
            </span>
          </p>
        </section>
      </FadeSection>

      {/* ── CTA FINAL ── */}
      <FadeSection>
        <section style={{ padding: '80px 24px 100px', textAlign: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)', width: 280, height: 280, background: `radial-gradient(circle, ${COLORS.pink}22 0%, transparent 70%)`, pointerEvents: 'none', filter: 'blur(40px)' }} />
          <div style={{ position: 'relative', maxWidth: 440, margin: '0 auto' }}>
            {/* El remate: la pose con aura, la más llamativa del kit.
                Se guardó para el final a propósito — si apareciera antes,
                el cierre no tendría nada que no se hubiera visto ya. */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <PasitaLazy pose="flexionando" size={150} animacion="flotar" />
            </div>

            <h2 style={{ fontFamily: FONTS.orbitron, fontWeight: 900, fontSize: 'clamp(22px, 6vw, 32px)', marginBottom: 16, color: COLORS.text }}>
              Una semana gratis.<br />Si no te late, te sales y ya.
            </h2>
            <p style={{ fontSize: 15, color: COLORS.muted, marginBottom: 36, lineHeight: 1.6 }}>
              Sin contratos raros. Sin letras chiquitas.
            </p>
            <Link
              href="/onboarding"
              prefetch={true}
              style={{ background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.pink})`, border: 'none', color: '#fff', borderRadius: RADIUS.xl, padding: '18px 32px', fontFamily: FONTS.nunito, fontWeight: 900, fontSize: 18, cursor: 'pointer', width: '100%', maxWidth: 380, minHeight: 56, boxShadow: `0 0 40px ${COLORS.primary}44`, transition: 'transform 0.15s ease', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => handleCTA('cta_final')}
            >
              Empezar gratis →
            </Link>
            <p style={{ marginTop: 12, fontSize: 13, color: COLORS.muted, opacity: 0.6 }}>
              Tarda menos que escoger qué ver en Netflix.
            </p>
            <p style={{ marginTop: 20, fontSize: 13, color: COLORS.muted, opacity: 0.5 }}>
              ${PLAN_DISPLAY.estandar_v2.prices.mensual.amount} al mes · 7 días gratis · No se cobra hasta el día 8
            </p>
          </div>
        </section>
      </FadeSection>

      {/* ── WhatsApp flotante ── */}
      <WhatsAppButton onClick={() => track('landing_whatsapp_clicked')} />

      {/* ── Footer ── */}
      <footer style={{ padding: '32px 24px 40px', borderTop: `1px solid ${COLORS.inputBorder}` }}>
        <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: COLORS.muted }}>
            <Logo size={28} />
            <span style={{ fontFamily: FONTS.orbitron, fontWeight: 900, fontSize: 14, letterSpacing: 2 }}>
              PASAS.MX
            </span>
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
            {[
              { href: '/ayuda', label: '❓ Ayuda' },
              { href: '/como-cancelar', label: '🚪 Cómo cancelar' },
              { href: '/privacidad', label: 'Privacidad' },
              { href: '/terminos', label: 'Términos' },
              { href: '/reembolso', label: 'Reembolsos' },
              { href: '/status', label: '🟢 Status' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                style={{
                  fontSize: 13,
                  color: COLORS.muted,
                  opacity: 0.6,
                  fontWeight: 600,
                  textDecoration: 'none',
                  padding: '4px 10px',
                  borderRadius: 8,
                  border: `1px solid transparent`,
                  transition: 'opacity 0.2s, border-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1'
                  e.currentTarget.style.borderColor = COLORS.inputBorder
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.6'
                  e.currentTarget.style.borderColor = 'transparent'
                }}
              >
                {label}
              </Link>
            ))}
          </div>
          <p style={{ fontSize: 12, color: COLORS.muted, opacity: 0.35, margin: 0 }}>
            © 2026 Pasas.mx · Hecho en México 🇲🇽
          </p>
        </div>
      </footer>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        p, span, div {
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
        }
      `}</style>
    </div>
  )
}
