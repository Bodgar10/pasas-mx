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
import { usePromo } from '@/hooks/usePromo'
import { conPromo, copyCTA, leyendaPromo, microcopyPromo, promoAplica } from '@/lib/promos'
import { useEsperandoPromo } from '@/hooks/useEsperandoPromo'
import { Hueco } from '@/components/global/HuecoPromo'
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
    sub: 'Pasas.mx explica cada materia con lo que ya le gusta: videojuegos, anime, K-pop o fútbol. Deja de pelear por las tareas.',
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

/**
 * 🔴 SIN MARCAS DE TERCEROS. La landing es material promocional público: citar
 * Minecraft, BTS o la Premier League aquí es uso comercial de marca ajena, y
 * hay una solicitud de marca propia en curso ante el IMPI. Las categorías
 * genéricas dicen lo mismo sin apropiarse de nada.
 *
 * 🔴 Y NADA DE MATERIAS QUE NO EXISTEN. La versión anterior prometía
 * "Programación con Roblox" y no hay materia de programación en el temario.
 * Es la promesa vacía que se cerró en s26: si mañana existe, se anuncia
 * entonces.
 *
 * El emoji del anime pasa de ⚔️ a 🌸 con el copy nuevo.
 *
 * Esto NO afecta al contenido de la plataforma: los topics y themes de la base
 * siguen igual, y ahí las referencias son contenido editorial, no reclamo
 * publicitario.
 */
const THEMES = [
  { emoji: '🎮', name: 'Videojuegos', color: COLORS.primary, desc: 'Matemáticas con mundos de bloques. Física con battle royale. Si le metes horas, que cuenten.' },
  { emoji: '🎤', name: 'K-pop', color: COLORS.pink, desc: 'Historia, geografía e inglés con los grupos que te sabes de memoria. El coreano se te pega de paso.' },
  { emoji: '🌸', name: 'Anime', color: COLORS.cyan, desc: 'Filosofía con thrillers psicológicos. Historia japonesa con espadas. Biología con células que hablan. Sí, es real.' },
  { emoji: '⚽', name: 'Fútbol', color: COLORS.success, desc: 'Estadística con la liga que sigues. Geografía con el Mundial. Inglés con las ligas de allá. Para los que sí ven los 90 minutos.' },
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
  { emoji: '⚡', step: '03', title: 'Aprende con lo que ya te gusta', desc: 'Cada lección, ejemplo y quiz usa tu temática. Matemáticas con videojuegos. Historia con anime. Siempre.' },
  { emoji: '🏆', step: '04', title: 'Sube de nivel', desc: 'Gana XP, mantén tu racha diaria y desbloquea contenido. El progreso se siente porque se ve.' },
]

const TUTORIAL_PERSONALIZED = [
  { emoji: '🎯', step: '01', title: 'Elige la materia que te cuesta', desc: 'Solo una. La que más te pesa, la que vas a reprobar, la que no entiendes por nada.' },
  { emoji: '🧠', step: '02', title: 'Haz el diagnóstico', desc: 'Un quiz corto detecta exactamente dónde están tus huecos. No adivinamos — medimos.' },
  { emoji: '✨', step: '03', title: 'Tu guía se genera solo para ti', desc: 'Con tu temática, tus puntos débiles y tu nivel. No es un temario genérico — es tuyo.' },
  { emoji: '📈', step: '04', title: 'Avanza más rápido', desc: 'Sin perder tiempo en lo que ya sabes. El plan personalizado va directo a lo que necesitas.' },
]

// `key` es la clave de PLAN_DISPLAY y la que guarda promo_campaigns.planes.
// Sin ella habría que adivinar el plan desde `name`, y una promo se decidiría
// comparando strings de UI.
const PLANS = [
  {
    key: 'estandar_v2',
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
    key: 'personalizado_v2',
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
/**
 * La etiqueta de un CTA mientras no se sabe si hay campaña.
 *
 * 🔴 Sustituye SOLO el texto de dentro, no el botón. El contenedor —ancho,
 * alto mínimo, padding, radio— es el mismo elemento de siempre, así que el
 * reemplazo no puede mover el layout: no hay dos geometrías que cuadrar, hay
 * una. Es también la razón de que no haga falta medir a mano los seis CTA de
 * esta pantalla, que tienen tamaños distintos entre sí.
 */
function EtiquetaCTA({
  esperando,
  ancho,
  children,
}: {
  esperando: boolean
  ancho: number
  children: React.ReactNode
}) {
  return esperando ? <Hueco alto={16} ancho={ancho} radio={5} /> : <>{children}</>
}

function CTAIntermedio({
  texto,
  microcopy,
  location,
  esperando,
  href,
  onClick,
}: {
  texto: string
  /** REGLA D: con promo llega el sublabel de la campaña ya compuesto. */
  microcopy: string
  location: string
  /** Mientras es true, ni la etiqueta ni la microcopy se pintan. */
  esperando: boolean
  /**
   * Destino ya compuesto por el padre con conPromo(). Llega por prop en vez de
   * quedarse en '/onboarding' fijo porque el slug tiene que viajar en la URL:
   * sessionStorage no sobrevive a una pestaña nueva ni a un enlace compartido.
   */
  href: string
  onClick: (location: string) => void
}) {
  return (
    <div style={{ padding: '0 24px 64px', maxWidth: 520, margin: '0 auto' }}>
      <Link
        href={href}
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
        <EtiquetaCTA esperando={esperando} ancho={210}>{texto}</EtiquetaCTA>
      </Link>
      <p style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: COLORS.muted, opacity: 0.55, display: 'flex', justifyContent: 'center' }}>
        {esperando ? <Hueco alto={18} ancho={230} radio={5} /> : microcopy}
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

  /*
    Promoción. Se resuelve UNA vez para toda la landing.

    🔴 REGLA F: esto cambia el TEXTO de los CTA, no la variante. `variant`
    sigue saliendo de getOrAssignVariant()/detectAudience como siempre y
    HERO_VARIANTS queda intacto — el A/B mide lo mismo con y sin campaña.

    🔴 Mientras usePromo() carga, `promo` es null y todo pinta normal: ni
    placeholder ni precio a medias.

    La landing solo vende el mensual del Estándar (el resto de ciclos vive en
    /planes), así que aquí el ciclo es 'mensual' fijo. La tarjeta de precios
    usa plan.key, por lo que la de Personalizado no se decora sola: no está en
    promo.planes.
  */
  const { promo, cargando: promoCargando, hayIndicio } = usePromo()

  /**
   * 🔴 La landing es PÚBLICA: no usa useYaTuvoSuscripcion (no hay sesión que
   * consultar), así que aquí solo cuenta lo que tarde usePromo.
   *
   * Sin indicio de campaña esto es false ya en el primer render: el tráfico
   * normal, que es casi todo, ve la landing igual de rápido que antes.
   */
  const esperandoPromo = useEsperandoPromo(hayIndicio, promoCargando)

  const CICLO_LANDING = 'mensual'
  const aplicaPromoEstandar = promoAplica(promo, 'estandar_v2', CICLO_LANDING)
  const leyendaEstandar = leyendaPromo(promo, 'estandar_v2', CICLO_LANDING)

  // Nav: sin microcopy, solo label.
  const ctaNav = copyCTA(promo, 'estandar_v2', CICLO_LANDING, {
    label: 'Gratis →',
    sublabel: null,
  })

  // Hero: el label y la micro de la variante activa son el fallback.
  const ctaHero = copyCTA(promo, 'estandar_v2', CICLO_LANDING, {
    label: hero.cta,
    sublabel: hero.micro,
  })

  // CTAs intermedios: cada uno conserva su texto propio como fallback.
  const ctaPostDemos = copyCTA(promo, 'estandar_v2', CICLO_LANDING, {
    label: 'Ya lo probaste. Entra gratis →',
    sublabel: '7 días gratis · Cancela cuando quieras',
  })
  // La etiqueta era "Así se va a ver tu cuenta. Empieza gratis →". Ese "así"
  // apuntaba a las capturas de arriba, que están apagadas tras
  // ENABLE_LANDING_SCREENSHOTS: sin ellas señalaba a nada. La nueva se sostiene
  // sola y sirve igual cuando las capturas vuelvan.
  const ctaPostCapturas = copyCTA(promo, 'estandar_v2', CICLO_LANDING, {
    label: 'Empieza gratis →',
    sublabel: '7 días gratis · Cancela cuando quieras',
  })

  const ctaFinal = copyCTA(promo, 'estandar_v2', CICLO_LANDING, {
    label: 'Empezar gratis →',
    sublabel: null,
  })

  /**
   * 🔴 EL DESTINO DE TODOS LOS CTA DEL EMBUDO, con el slug pegado.
   *
   * Se calcula UNA vez y lo usan nav, hero, los dos CTAIntermedio y el CTA
   * final. Antes cada uno tenía '/onboarding' escrito a mano y el slug solo
   * viajaba en sessionStorage: bastaba una pestaña nueva, un enlace compartido
   * o un navegador con el almacenamiento bloqueado —los de dentro de TikTok e
   * Instagram, que son el origen del tráfico de campaña— para llegar a /planes
   * sin promo y sin ninguna señal de que se perdió.
   *
   * Va condicionado a `aplicaPromoEstandar` y no solo a que exista `promo`:
   * si la campaña no cubre estandar_v2 + mensual, la landing no la decora, y
   * mandar el slug igual llevaría a /planes un param que no promete nada aquí.
   */
  const destinoOnboarding = conPromo(
    '/onboarding',
    aplicaPromoEstandar ? promo?.slug : null
  )

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
            href={destinoOnboarding}
            prefetch={true}
            onClick={() => handleCTA('nav')}
            style={{ background: COLORS.primary, border: 'none', color: '#fff', borderRadius: RADIUS.lg, padding: '8px 16px', fontFamily: FONTS.nunito, fontWeight: 900, fontSize: 14, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >
            <EtiquetaCTA esperando={esperandoPromo} ancho={64}>{ctaNav.label}</EtiquetaCTA>
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
            href={destinoOnboarding}
            prefetch={true}
            onClick={() => handleCTA('hero')}
            style={{ background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.pink})`, border: 'none', color: '#fff', borderRadius: RADIUS.xl, padding: '16px 32px', fontFamily: FONTS.nunito, fontWeight: 900, fontSize: 17, cursor: 'pointer', width: '100%', maxWidth: 360, minHeight: 52, boxShadow: `0 0 32px ${COLORS.primary}55`, transition: 'transform 0.15s ease, box-shadow 0.15s ease', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <EtiquetaCTA esperando={esperandoPromo} ancho={220}>{ctaHero.label}</EtiquetaCTA>
          </Link>
          {/* REGLA D: con promo, su sublabel reemplaza la micro de la variante,
              pero "Cancela cuando quieras" no se pierde. */}
          <p style={{ marginTop: 12, fontSize: 13, color: COLORS.muted, opacity: 0.7, display: 'flex', justifyContent: 'center' }}>
            {esperandoPromo
              ? <Hueco alto={20} ancho={250} radio={5} />
              : microcopyPromo(ctaHero.sublabel, ['Cancela cuando quieras'])}
          </p>
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
          texto={ctaPostDemos.label}
          microcopy={microcopyPromo(ctaPostDemos.sublabel, ['Cancela cuando quieras'])}
          location="post_demos"
          esperando={esperandoPromo}
          href={destinoOnboarding}
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

      {/* ── ASÍ SE VE POR DENTRO ──
          Apagado por ENABLE_LANDING_SCREENSHOTS (ver src/lib/feature-flags.ts):
          las capturas traen marcas de terceros quemadas dentro del PNG. El
          bloque entero —rótulo, título, bajada, pestañas y carrusel— vive
          dentro de este condicional, así que al apagarlo no queda ningún
          título huérfano. */}
      {FEATURE_FLAGS.ENABLE_LANDING_SCREENSHOTS && (
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
      )}

      <FadeSection>
        <CTAIntermedio
          texto={ctaPostCapturas.label}
          microcopy={microcopyPromo(ctaPostCapturas.sublabel, ['Cancela cuando quieras'])}
          /*
            🔴 `location` se conserva aunque el nombre ya no describa el sitio:
            cortar la serie de PostHog cuesta más que la incoherencia.

            DESDE AGOSTO 2026 ESTE CTA NO VA DESPUÉS DE LAS CAPTURAS. El bloque
            "Así se ve por dentro" está apagado tras
            ENABLE_LANDING_SCREENSHOTS, así que ahora cae justo después de las
            cuatro temáticas ("Escoge tu mundo"). Quien compare la conversión
            de `post_capturas` antes y después de esa fecha está comparando dos
            posiciones distintas del embudo, con un argumento previo distinto
            —temáticas en vez de capturas de producto—. No es el mismo CTA con
            otro copy: es otro momento de la página.
          */
          location="post_capturas"
          esperando={esperandoPromo}
          href={destinoOnboarding}
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
          {/* REGLA C — con promo, los tres datos van en el encabezado: lista
              tachada, primer cargo y lo que se cobra después. El argumento del
              maestro particular sigue comparándose contra el precio de lista,
              que es el que se paga a partir del segundo mes. */}
          <h2 style={{ fontFamily: FONTS.orbitron, fontWeight: 900, fontSize: 'clamp(22px, 6vw, 30px)', textAlign: 'center', marginBottom: 12, color: COLORS.text }}>
            {esperandoPromo ? (
              /*
                🔴 Este encabezado ES un precio: dice "$249 al mes" o "$249 $1
                primer mes · después $249/mes". El hueco reserva sus tres
                líneas —dos de titular y la de 0.6em— para que el cambio no
                empuje la tarjeta de precios que va debajo.
              */
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <Hueco alto={30} ancho={280} radio={8} />
                <Hueco alto={30} ancho={230} radio={8} />
                <Hueco alto={18} ancho={300} radio={6} />
              </span>
            ) : leyendaEstandar ? (
              <>
                <span style={{ textDecoration: 'line-through', color: COLORS.muted, opacity: 0.7 }}>
                  {leyendaEstandar.listaTexto}
                </span>{' '}
                {leyendaEstandar.finalTexto}.<br />
                <span style={{ fontSize: '0.6em', color: COLORS.muted }}>
                  {leyendaEstandar.despuesTexto} — un maestro particular cobra eso por una hora.
                </span>
              </>
            ) : (
              <>
                ${PLAN_DISPLAY.estandar_v2.prices.mensual.amount} al mes.<br />Un maestro particular cobra eso por una hora.
              </>
            )}
          </h2>
          <p style={{ textAlign: 'center', fontSize: 14, color: COLORS.muted, marginBottom: 24, lineHeight: 1.6 }}>
            Sin contrato. Cancela cuando quieras. Sin letras chiquitas.
          </p>

          {/* Pulgar arriba sobre el precio: es donde el visitante duda. */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <PasitaLazy pose="aprobando" size={100} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {PLANS.map((plan, i) => {
              /*
                🔴 REGLA A — la decoración se decide por plan.key contra
                promo.planes. PASAS1 solo trae 'estandar_v2', así que la
                tarjeta Personalizado se queda intacta sin ningún `if` que
                mencione su nombre: si mañana la campaña la incluye, se decora
                sola.
              */
              const leyendaCard = leyendaPromo(promo, plan.key, CICLO_LANDING)
              const ctaCard = copyCTA(promo, plan.key, CICLO_LANDING, {
                label: plan.cta,
                sublabel: plan.note,
              })
              const aplicaEnTarjeta = promoAplica(promo, plan.key, CICLO_LANDING)
              const badgePromo = aplicaEnTarjeta ? promo?.badge_landing ?? null : null

              // El slug viaja por la MISMA condición que decide la decoración:
              // la tarjeta que no se decora tampoco lo arrastra. Con PASAS1
              // eso deja fuera a Personalizado sin nombrarla, igual que el
              // badge y el precio de arriba.
              const destinoTarjeta = conPromo(
                '/onboarding',
                aplicaEnTarjeta ? promo?.slug : null
              )

              return (
              <div key={i} style={{ background: plan.highlight ? `linear-gradient(135deg, ${COLORS.card} 0%, ${COLORS.card2} 100%)` : COLORS.card, borderRadius: RADIUS.xxl, padding: '28px 24px', border: `1.5px solid ${plan.highlight ? plan.color + '66' : COLORS.inputBorder}`, position: 'relative', overflow: 'hidden' }}>
                {/* El badge de promo ocupa el mismo lugar que el de la tarjeta
                    y tiene prioridad. En Estándar el slot está libre
                    (plan.badge es null), así que no tapa nada. */}
                {badgePromo ? (
                  <div style={{ position: 'absolute', top: 16, right: 16, background: `${COLORS.success}22`, border: `1px solid ${COLORS.success}66`, borderRadius: RADIUS.pill, padding: '4px 12px', fontSize: 11, fontWeight: 800, color: COLORS.success }}>
                    🎟️ {badgePromo}
                  </div>
                ) : plan.badge ? (
                  <div style={{ position: 'absolute', top: 16, right: 16, background: `${plan.color}22`, border: `1px solid ${plan.color}55`, borderRadius: RADIUS.pill, padding: '4px 12px', fontSize: 11, fontWeight: 800, color: plan.color }}>
                    {plan.badge}
                  </div>
                ) : null}
                {plan.highlight && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.pink})` }} />
                )}
                <p style={{ fontFamily: FONTS.orbitron, fontWeight: 900, fontSize: 15, color: plan.color, marginBottom: 4 }}>{plan.name}</p>
                {esperandoPromo ? (
                  /*
                    El hueco imita la variante con promo: la fila del precio
                    (32px de titular con el tachado de 20px alineado a la
                    base) y la línea de "después". `marginBottom: 8` es el
                    mismo de las dos variantes reales.
                  */
                  <div style={{ marginBottom: 8 }}>
                    <Hueco alto={40} ancho={210} radio={10} />
                    <div style={{ height: 6 }} />
                    <Hueco alto={18} ancho={170} radio={6} />
                  </div>
                ) : leyendaCard ? (
                  /* REGLA C — los tres juntos. */
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 20, color: COLORS.muted, textDecoration: 'line-through' }}>
                        {leyendaCard.listaTexto}
                      </span>
                      <span style={{ fontFamily: FONTS.orbitron, fontWeight: 900, fontSize: 32, color: COLORS.text }}>
                        {leyendaCard.finalTexto}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: COLORS.muted, margin: '6px 0 0', fontWeight: 700 }}>
                      {leyendaCard.despuesTexto}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontFamily: FONTS.orbitron, fontWeight: 900, fontSize: 36, color: COLORS.text }}>{plan.price}</span>
                    <span style={{ fontSize: 14, color: COLORS.muted, fontWeight: 600 }}>{plan.period}</span>
                  </div>
                )}
                <p style={{ fontSize: 14, color: COLORS.muted, marginBottom: 20, lineHeight: 1.5 }}>{plan.description}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                  {plan.features.map((f, j) => (
                    <p key={j} style={{ fontSize: 14, color: COLORS.text, fontWeight: 600 }}>{f}</p>
                  ))}
                </div>
                <Link
                  href={destinoTarjeta}
                  prefetch={true}
                  onClick={() => handleCTA(`pricing_${plan.name.toLowerCase()}`)}
                  style={{ background: plan.highlight ? `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.pink})` : `${COLORS.primary}22`, border: plan.highlight ? 'none' : `1.5px solid ${COLORS.primary}55`, color: plan.highlight ? '#fff' : COLORS.primary, borderRadius: RADIUS.xl, padding: '14px 24px', fontFamily: FONTS.nunito, fontWeight: 900, fontSize: 15, cursor: 'pointer', width: '100%', minHeight: 52, transition: 'transform 0.15s ease', boxShadow: plan.highlight ? `0 0 24px ${COLORS.primary}44` : 'none', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <EtiquetaCTA esperando={esperandoPromo} ancho={190}>{ctaCard.label}</EtiquetaCTA>
                </Link>
                {/* REGLA D: "Requiere tarjeta" y "Cancela cuando quieras"
                    estaban aquí y aquí se quedan, promo o no. */}
                <p style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: COLORS.muted, opacity: 0.6, display: 'flex', justifyContent: 'center' }}>
                  {esperandoPromo
                    ? <Hueco alto={18} ancho={215} radio={5} />
                    : microcopyPromo(ctaCard.sublabel, ['Requiere tarjeta', 'Cancela cuando quieras'])}
                </p>
              </div>
              )
            })}
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

            {/* Con promo se cae "Una semana gratis." y nada más: el CTA de
                abajo ya dice la oferta. Sin promo, idéntico a como estaba. */}
            <h2 style={{ fontFamily: FONTS.orbitron, fontWeight: 900, fontSize: 'clamp(22px, 6vw, 32px)', marginBottom: 16, color: COLORS.text }}>
              {esperandoPromo ? (
                /* Con promo pierde la línea "Una semana gratis."; el hueco
                   reserva las dos para no encoger al llegar los datos. */
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <Hueco alto={32} ancho={260} radio={8} />
                  <Hueco alto={32} ancho={300} radio={8} />
                </span>
              ) : aplicaPromoEstandar ? (
                <>Si no te late, te sales y ya.</>
              ) : (
                <>Una semana gratis.<br />Si no te late, te sales y ya.</>
              )}
            </h2>
            <p style={{ fontSize: 15, color: COLORS.muted, marginBottom: 36, lineHeight: 1.6 }}>
              Sin contratos raros. Sin letras chiquitas.
            </p>
            <Link
              href={destinoOnboarding}
              prefetch={true}
              style={{ background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.pink})`, border: 'none', color: '#fff', borderRadius: RADIUS.xl, padding: '18px 32px', fontFamily: FONTS.nunito, fontWeight: 900, fontSize: 18, cursor: 'pointer', width: '100%', maxWidth: 380, minHeight: 56, boxShadow: `0 0 40px ${COLORS.primary}44`, transition: 'transform 0.15s ease', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => handleCTA('cta_final')}
            >
              <EtiquetaCTA esperando={esperandoPromo} ancho={200}>{ctaFinal.label}</EtiquetaCTA>
            </Link>
            <p style={{ marginTop: 12, fontSize: 13, color: COLORS.muted, opacity: 0.6 }}>
              Tarda menos que escoger qué ver en la tele.
            </p>
            {/* REGLA C — con promo esta línea es precio, y los tres datos van
                juntos. La promesa del trial pasa a la línea de abajo, que es
                el sublabel de la campaña: no se apilan, se reparten. */}
            <p style={{ marginTop: 20, fontSize: 13, color: COLORS.muted, opacity: 0.5, display: 'flex', justifyContent: 'center' }}>
              {esperandoPromo ? (
                /* También es precio: "$249 al mes · 7 días gratis…" o la
                   leyenda con tachado. Una sola línea en las dos variantes. */
                <Hueco alto={20} ancho={320} radio={5} />
              ) : leyendaEstandar ? (
                <>
                  <span style={{ textDecoration: 'line-through' }}>{leyendaEstandar.listaTexto}</span>
                  {' '}{leyendaEstandar.finalTexto} · {leyendaEstandar.despuesTexto}
                </>
              ) : (
                <>
                  ${PLAN_DISPLAY.estandar_v2.prices.mensual.amount} al mes · 7 días gratis · No se cobra hasta el día 8
                </>
              )}
            </p>
            {aplicaPromoEstandar && ctaFinal.sublabel && (
              <p style={{ marginTop: 6, fontSize: 13, color: COLORS.muted, opacity: 0.5 }}>
                {microcopyPromo(ctaFinal.sublabel, ['Cancela cuando quieras'])}
              </p>
            )}
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
