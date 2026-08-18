import type { Metadata } from 'next'

/**
 * 🔴 ESTE LAYOUT EXISTE SOLO PARA PODER DECLARAR EL CANONICAL.
 *
 * `reembolso/page.tsx` es `'use client'` —tiene un formulario con estado— y un
 * componente de cliente no puede exportar `metadata`: Next solo la lee de
 * componentes de servidor. Un layout sí lo es, así que es el único sitio donde
 * cabe. Mismo motivo que el `metadata` de (auth)/layout.tsx.
 *
 * No envuelve nada ni pinta nada: devuelve `children` tal cual. Si algún día
 * /reembolso deja de ser 'use client', esto se borra y el canonical se mueve a
 * la página.
 *
 * Relativo: lo resuelve el metadataBase del layout raíz.
 */
export const metadata: Metadata = {
  alternates: { canonical: '/reembolso' },
}

export default function ReembolsoLayout({ children }: { children: React.ReactNode }) {
  return children
}
