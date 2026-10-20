import { redirect } from 'next/navigation'
import { getRol, getUsuario } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // getUsuario/getRol van con React cache(): la página de /admin que vuelva a
  // pedirlos en este mismo request recibe la misma respuesta sin otro viaje.
  const { user } = await getUsuario()
  if (!user) redirect('/login')

  if ((await getRol(user.id)) !== 'admin') redirect('/dashboard')

  return <>{children}</>
}
