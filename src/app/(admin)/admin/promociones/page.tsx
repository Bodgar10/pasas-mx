import { createClient } from '@/utils/supabase/server'
import PromocionesClient from './promociones-client'
import { PROMO_COLUMNS, type PromoCampaign } from '@/lib/promos'

/**
 * /admin/promociones
 *
 * Patrón del repo: el server component hace el select y pasa props; el client
 * escribe con createClient() de @/utils/supabase/client y llama
 * router.refresh(). Igual que admin-home-client.tsx y notificaciones-client.tsx.
 * Sin Server Actions.
 *
 * El gate de role = 'admin' lo hace src/app/(admin)/layout.tsx; esta página no
 * lo repite. La policy "promo_campaigns: admin" de la migración 042 es la que
 * permite ver las campañas apagadas — la policy pública solo deja ver las
 * activas.
 */
export default async function PromocionesPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('promo_campaigns')
    .select(PROMO_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/promociones] lectura de promo_campaigns fallo:', error)
  }

  const campanas: PromoCampaign[] = ((data ?? []) as unknown as PromoCampaign[]).map((c) => ({
    ...c,
    // `numeric` puede llegar como string; se normaliza aquí igual que en
    // getPromoActiva, porque precioConPromo espera un number.
    descuento_valor: Number(c.descuento_valor),
  }))

  return <PromocionesClient campanas={campanas} />
}
