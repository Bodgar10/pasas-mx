import { createClient } from '@supabase/supabase-js'
import { esEventoConteo, limpiarProps } from '@/lib/analytics/conteo'
import { CANALES } from '@/lib/arcade/canal'

/**
 * POST /api/m — conteo anónimo (lib/analytics/conteo.ts). s37.
 *
 * Recibe un evento de la lista cerrada y lo guarda en `eventos_anonimos`
 * SIN nada que identifique a la persona:
 *
 *  - La IP se usa solo en memoria para frenar abusos y no se guarda.
 *  - Del user agent se derivan dos datos gruesos (celular/computadora y
 *    navegador de app) y el resto se descarta.
 *  - Las propiedades se vuelven a limpiar aquí: no se confía en el cliente.
 *
 * Responde 204 siempre que el formato sea válido, guarde o no: al navegador
 * no le sirve saber más, y un bot no aprende qué se filtra.
 *
 * Solo escribe en producción. En local y en las vistas previas de Vercel
 * valida y responde igual, para no mezclar pruebas con tráfico real.
 */

const MAX_BYTES = 2048
const LIMITE_POR_MINUTO = 120

// Rastreadores y vistas previas de enlaces: no son personas. `^WhatsApp/`
// es el que arma la vista previa de un link; el navegador de una persona que
// abre el link desde WhatsApp no lleva esa marca y sí se cuenta.
const BOTS =
  /bot\b|bot\/|crawl|spider|slurp|facebookexternalhit|facebookcatalog|meta-externalagent|^WhatsApp\/|TelegramBot|headless|lighthouse|pagespeed|python|curl|wget|axios|node-fetch|go-http/i

const CANALES_VALIDOS = new Set<string>(CANALES)
const TRAMOS_CARGA = new Set(['<1s', '1-3s', '3-5s', '>5s'])

const vistos = new Map<string, { n: number; desde: number }>()

function excedeLimite(ip: string): boolean {
  const ahora = Date.now()
  const r = vistos.get(ip)
  if (!r || ahora - r.desde > 60_000) {
    vistos.set(ip, { n: 1, desde: ahora })
    if (vistos.size > 5000) vistos.clear()
    return false
  }
  r.n += 1
  return r.n > LIMITE_POR_MINUTO
}

function dispositivo(ua: string): 'celular' | 'computadora' {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(ua) ? 'celular' : 'computadora'
}

function navegadorApp(ua: string): 'instagram' | 'tiktok' | 'facebook' | 'otro' {
  if (/Instagram/i.test(ua)) return 'instagram'
  if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) return 'tiktok'
  if (/FBAN|FBAV/.test(ua)) return 'facebook'
  return 'otro'
}

function texto(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null
}

export async function POST(req: Request) {
  try {
    const crudo = await req.text()
    if (!crudo || crudo.length > MAX_BYTES) return new Response(null, { status: 400 })

    let b: Record<string, unknown>
    try {
      b = JSON.parse(crudo) as Record<string, unknown>
    } catch {
      return new Response(null, { status: 400 })
    }

    const evento = typeof b.e === 'string' ? b.e : ''
    if (!esEventoConteo(evento)) return new Response(null, { status: 400 })

    const ua = req.headers.get('user-agent') ?? ''
    if (!ua || BOTS.test(ua)) return new Response(null, { status: 204 })

    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'sin-ip'
    if (excedeLimite(ip)) return new Response(null, { status: 204 })

    if (process.env.VERCEL_ENV !== 'production') return new Response(null, { status: 204 })

    const canal = typeof b.c === 'string' && CANALES_VALIDOS.has(b.c) ? b.c : null
    const carga = typeof b.t === 'string' && TRAMOS_CARGA.has(b.t) ? b.t : null

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { error } = await supabase.from('eventos_anonimos').insert({
      evento,
      ruta: texto(b.r, 120),
      canal,
      utm_source: texto(b.us, 64),
      utm_campaign: texto(b.uc, 64),
      dispositivo: dispositivo(ua),
      navegador_app: navegadorApp(ua),
      carga,
      interno: b.i === true,
      props: limpiarProps(b.p),
    })
    if (error) console.error('[conteo] insert falló:', error.message)

    return new Response(null, { status: 204 })
  } catch (err) {
    console.error('[conteo] fallo no atrapado:', err)
    return new Response(null, { status: 204 })
  }
}
