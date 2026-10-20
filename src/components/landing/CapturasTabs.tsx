'use client'

import { useState } from 'react'
import Image from 'next/image'
import { COLORS, FONTS, RADIUS } from '@/lib/design-tokens'
import { track } from '@/lib/analytics/track'

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
      // ⚠️ AL VOLVER LAS CAPTURAS: este caption dice "fallas y salen las
      // pistas" y describe media mecánica — también se puede pedir pista sin
      // haber fallado. Reescribir junto con la captura nueva.
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

/** Ancho de cada tarjeta del carrusel. */
const ANCHO_TARJETA = 320
/** Padding del marco de teléfono, por lado. */
const MARCO = 8

/**
 * Pestañas + carrusel de "Así se ve por dentro".
 *
 * 🔴 `activeTab` VIVE AQUÍ. Antes era estado de la landing entera: picar una
 * pestaña re-renderizaba la página completa para cambiar cuatro imágenes.
 */
export default function CapturasTabs() {
  const [activeTab, setActiveTab] = useState('gaming')

  return (
    <>
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
          <div key={i} style={{ flexShrink: 0, scrollSnapAlign: 'start', width: ANCHO_TARJETA }}>
            {/* Marco de teléfono.
                Las capturas tienen el mismo fondo #0a0a0f que la landing, así
                que sin marco se funden con la página y no se ve dónde empieza
                la pantalla. El borde las separa y de paso comunica que el
                producto es móvil. */}
            <div
              style={{
                position: 'relative',
                padding: MARCO,
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
              {/* `sizes` = el ancho real pintado: tarjeta de 320 menos el
                  marco. Con él, Next arma el srcset por anchos (w) y el
                  navegador baja el más chico que cubra 304 px × la densidad de
                  la pantalla, en AVIF/WebP (ver `images` en next.config.ts). */}
              <Image
                src={screen.src}
                alt={screen.caption}
                width={ANCHO_TARJETA}
                height={696}
                sizes={`${ANCHO_TARJETA - MARCO * 2}px`}
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
    </>
  )
}
