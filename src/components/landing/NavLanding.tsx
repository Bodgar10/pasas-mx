'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { COLORS, FONTS, RADIUS } from '@/lib/design-tokens'
import Logo from '@/components/global/Logo'
import { track } from '@/lib/analytics/track'
import EtiquetaCTA from './EtiquetaCTA'

/** Alto del banner del Arcade que va encima de la nav. */
export const BANNER_ALTO = 40

/**
 * Banner del Arcade + nav fija de la landing.
 *
 * 🔴 `scrolled` VIVE AQUÍ Y NO EN LA LANDING. Antes era estado de la raíz:
 * cada vez que cruzaba los 40 px —y en móvil se cruza a cada rato al subir y
 * bajar— se re-renderizaba la página COMPLETA, demos y precios incluidos, solo
 * para cambiar el fondo de la nav. Ahora el listener y el estado son de este
 * componente y el resto de la página ni se entera.
 */
export default function NavLanding({
  variant,
  destinoOnboarding,
  ctaLabel,
  esperandoPromo,
  onCTA,
}: {
  /** Solo para la analítica del clic en el banner. */
  variant: string
  /** Ya compuesto con conPromo() por la landing. */
  destinoOnboarding: string
  ctaLabel: string
  esperandoPromo: boolean
  onCTA: (location: string) => void
}) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      {/* ── Banner del Arcade ──
          Encima de la nav y solo arriba de todo: al hacer scroll sube y la nav
          ocupa su lugar, así no le quita pantalla a la landing mientras se lee.
          🔴 Sin utm_source en el link: UTMPersistence guarda el PRIMER toque, y
          un utm interno pisaría el canal real (orgánico) de quien lo toque. El
          clic se mide con su propio evento, y ?desde= marca el origen en los
          eventos del Arcade, la Horda y el onboarding (lib/arcade.ts). */}
      {/* s51 — A/B del botón principal (cta-ab.ts): el banner acompaña al
          brazo. A lleva al reto; B, a la clase gratis. */}
      <div className="ab-reto">
      <Link
        href="/arcade?desde=landing_banner"
        onClick={() => track('landing_banner_arcade_clic', { variant })}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 101,
          height: BANNER_ALTO,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '0 16px',
          background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.pink})`,
          color: '#fff', textDecoration: 'none',
          fontFamily: FONTS.nunito, fontSize: 14, fontWeight: 800,
          whiteSpace: 'nowrap', overflow: 'hidden',
          transform: scrolled ? `translateY(-${BANNER_ALTO}px)` : 'translateY(0)',
          transition: 'transform 0.3s ease',
        }}
      >
        {/* s51: decía "¿Cuál sobra?"; el reto diario es Verdadero o mentira desde el 13 oct. */}
        <span style={{ fontWeight: 900 }}>¿Verdadero o mentira?</span>
        <span className="banner-arcade-medio" style={{ opacity: 0.9 }}>· Un reto nuevo cada día ·</span>
        <span style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>Juega gratis →</span>
      </Link>
      </div>
      <div className="ab-clase">
      <Link
        href="/clase-gratis"
        onClick={() => track('landing_cta_clicked', { location: 'banner_clase', variant })}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 101,
          height: BANNER_ALTO,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '0 16px',
          background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.pink})`,
          color: '#fff', textDecoration: 'none',
          fontFamily: FONTS.nunito, fontSize: 14, fontWeight: 800,
          whiteSpace: 'nowrap', overflow: 'hidden',
          transform: scrolled ? `translateY(-${BANNER_ALTO}px)` : 'translateY(0)',
          transition: 'transform 0.3s ease',
        }}
      >
        <span style={{ fontWeight: 900 }}>🎁 Tu primera clase gratis</span>
        <span className="banner-arcade-medio" style={{ opacity: 0.9 }}>· Con su hobby ·</span>
        <span style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>Tómala →</span>
      </Link>
      </div>
      <style>{`@media (max-width: 360px){ .banner-arcade-medio{ display:none } }`}</style>

      {/* ── Sticky nav ── */}
      <nav style={{
        position: 'fixed', top: scrolled ? 0 : BANNER_ALTO, left: 0, right: 0, zIndex: 100,
        padding: '0 20px',
        height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(15,10,30,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? `1px solid ${COLORS.inputBorder}` : 'none',
        transition: 'background 0.3s ease, border 0.3s ease, top 0.3s ease',
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
          {/* 🔴 Sin prefetch={true}: /onboarding es dinámica y `true` le pide
              al servidor su render COMPLETO en cada visita a la landing, aunque
              el 69% se vaya en menos de 5 s. El prefetch por defecto trae solo
              la parte estática, hasta el loading.js más cercano si lo hay. */}
          <Link
            href={destinoOnboarding}
            onClick={() => onCTA('nav')}
            style={{ background: COLORS.primary, border: 'none', color: '#fff', borderRadius: RADIUS.lg, padding: '8px 16px', fontFamily: FONTS.nunito, fontWeight: 900, fontSize: 14, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >
            <EtiquetaCTA esperando={esperandoPromo} ancho={64}>{ctaLabel}</EtiquetaCTA>
          </Link>
        </div>
      </nav>
    </>
  )
}
