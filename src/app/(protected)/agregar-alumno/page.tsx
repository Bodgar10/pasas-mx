import { redirect } from 'next/navigation'
import { getUsuario } from '@/lib/auth'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getAccountLearners } from '@/lib/learners'
import AgregarClient from './agregar-client'

export default async function AgregarAlumnoPage() {
  const { supabase, user } = await getUsuario()
  if (!user) redirect('/login')

  // Mismo patron que /onboarding: las tematicas son datos publicos y se
  // leen con service role. No dependen del usuario: van en paralelo con los
  // alumnos de la cuenta.
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // El preview del prorrateo NO se pide aqui: lo pide el cliente al
  // montar. Es una llamada a Stripe y bloquear el render del servidor
  // con ella dejaria la pantalla en blanco mientras responde.
  const [todos, { data: themes }] = await Promise.all([
    getAccountLearners(supabase, user.id),
    serviceClient
      .from('themes')
      .select('id, name, description, icon, subtitle')
      .eq('active', true)
      .order('created_at', { ascending: true }),
  ])

  // Solo los 'active' entran al paso 1. getAccountLearners tambien
  // devuelve los 'ending' con acceso vigente —el selector del dashboard
  // los necesita— pero aqui ofrecerlos como "el mismo, otro grado"
  // crearia un segundo lugar DE PAGO para alguien que acaba de darse de
  // baja del primero. Esa persona se reactiva gratis desde /perfil;
  // venderle un lugar nuevo seria cobrarle dos veces por lo mismo.
  const alumnos = todos.filter((a) => a.status === 'active')

  return <AgregarClient alumnos={alumnos} themes={themes ?? []} />
}
