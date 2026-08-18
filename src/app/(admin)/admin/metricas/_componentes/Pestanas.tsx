'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { COLORES } from '@/components/admin/Tarjetas'
import { SECCIONES } from './secciones'

/**
 * Pestañas y toggle de cuentas de prueba.
 *
 * 🔴 El toggle vive en la URL (`?prueba=1`), no en estado de React.
 *
 * Dos motivos. Uno: `layout.tsx` no recibe `searchParams` en el App Router,
 * así que un estado de cliente no podría alcanzar a la franja fija ni a los
 * datos de la pestaña, que se resuelven en el servidor. Dos: así el tablero
 * es enlazable — se puede mandar "mira esto con las de prueba incluidas".
 *
 * 🔴 `SECCIONES` y `SlugSeccion` se importan de `./secciones` y NO se
 * reexportan desde aquí. Estaban definidos en este archivo, que es
 * `'use client'`, y `[seccion]/page.tsx` —server component— los importaba:
 * recibía un proxy de cliente en vez del array y `next build` caía entero con
 * `SECCIONES.map is not a function`. Reexportarlos volvería a abrir la puerta.
 */

export default function Pestanas({ cuentasDePrueba }: { cuentasDePrueba: number }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const incluirPrueba = searchParams.get('prueba') === '1'

  const con = (slug: string) => `/admin/metricas/${slug}${incluirPrueba ? '?prueba=1' : ''}`
  const actual = pathname.split('/')[3] ?? ''

  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {SECCIONES.map((s) => {
          const activa = s.slug === actual
          return (
            <Link
              key={s.slug}
              href={con(s.slug)}
              style={{
                padding: '8px 14px',
                borderRadius: 50,
                fontSize: 14,
                fontWeight: 800,
                textDecoration: 'none',
                fontFamily: 'var(--font-nunito)',
                background: activa ? COLORES.primario : COLORES.fondo,
                color: activa ? '#fff' : COLORES.suave,
                border: activa ? 'none' : `1px solid ${COLORES.borde}`,
              }}
            >
              {s.emoji} {s.label}
            </Link>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        <Link
          href={`/admin/metricas/${actual}${incluirPrueba ? '' : '?prueba=1'}`}
          role="switch"
          aria-checked={incluirPrueba}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 14px',
            borderRadius: 50,
            textDecoration: 'none',
            fontFamily: 'var(--font-nunito)',
            fontSize: 14,
            fontWeight: 800,
            background: incluirPrueba ? 'rgba(251,191,36,0.12)' : COLORES.fondo,
            border: `1px solid ${incluirPrueba ? 'rgba(251,191,36,0.45)' : COLORES.borde}`,
            color: incluirPrueba ? COLORES.ambar : COLORES.suave,
          }}
        >
          <span style={{ width: 34, height: 20, borderRadius: 50, flexShrink: 0, background: incluirPrueba ? COLORES.ambar : COLORES.borde, position: 'relative' }}>
            <span style={{ position: 'absolute', top: 3, left: incluirPrueba ? 17 : 3, width: 14, height: 14, borderRadius: '50%', background: COLORES.fondo2 }} />
          </span>
          Incluir cuentas de prueba
        </Link>
        <span style={{ fontSize: 13, color: incluirPrueba ? COLORES.ambar : COLORES.tenue }}>
          {incluirPrueba
            ? `⚠️ Incluyendo ${cuentasDePrueba} cuenta${cuentasDePrueba === 1 ? '' : 's'} de prueba — estos números no son reales`
            : `${cuentasDePrueba} cuenta${cuentasDePrueba === 1 ? '' : 's'} de prueba excluida${cuentasDePrueba === 1 ? '' : 's'}`}
        </span>
      </div>
    </>
  )
}
