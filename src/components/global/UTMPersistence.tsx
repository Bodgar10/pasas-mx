'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export default function UTMPersistence() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const utmSource = searchParams.get('utm_source')
    const utmMedium = searchParams.get('utm_medium')
    const utmCampaign = searchParams.get('utm_campaign')
    const utmContent = searchParams.get('utm_content')
    const utmTerm = searchParams.get('utm_term')

    // Solo guardar si hay al menos utm_source
    if (!utmSource) return

    // Guardar en sessionStorage para sobrevivir navegación interna
    const existing = sessionStorage.getItem('pasas_utm')
    if (existing) return // First touch wins — no sobreescribir

    const utmData = {
      utm_source: utmSource,
      utm_medium: utmMedium || undefined,
      utm_campaign: utmCampaign || undefined,
      utm_content: utmContent || undefined,
      utm_term: utmTerm || undefined,
      referrer: document.referrer || undefined,
      landing_url: window.location.href,
    }

    sessionStorage.setItem('pasas_utm', JSON.stringify(utmData))

    // Mandar al endpoint (best effort, no bloquea)
    fetch('/api/track-source', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(utmData),
    }).catch(() => {})
  }, [searchParams])

  return null
}
