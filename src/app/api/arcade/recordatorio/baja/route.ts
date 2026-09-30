import { NextResponse } from 'next/server'
import { db } from '@/lib/arcade/recordatorio'

export const dynamic = 'force-dynamic'

/**
 * Baja del recordatorio. GET desde el enlace del correo; POST para la baja en
 * un clic de los clientes de correo (List-Unsubscribe-Post).
 *
 * 🔴 Funciona aunque el flag esté apagado: una baja siempre se respeta.
 */
async function darDeBaja(t: string | null): Promise<boolean> {
  if (!t || t.length > 100) return false
  const { data } = await db()
    .from('arcade_suscriptores')
    .update({ estado: 'baja', baja_at: new Date().toISOString() })
    .eq('token_baja', t)
    .neq('estado', 'baja')
    .select('id')
  return (data?.length ?? 0) > 0
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  await darDeBaja(url.searchParams.get('t'))
  return NextResponse.redirect(new URL('/arcade?recordatorio=baja', url), 303)
}

export async function POST(req: Request) {
  await darDeBaja(new URL(req.url).searchParams.get('t'))
  return new NextResponse('Listo, ya no recibirás el recordatorio.', { status: 200 })
}
