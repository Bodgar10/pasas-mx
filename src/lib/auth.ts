import 'server-only'

import { cache } from 'react'
import { createClient } from '@/utils/supabase/server'

/**
 * SESIÓN DEL REQUEST — UNA SOLA VEZ POR RENDER
 * ---------------------------------------------------------------------------
 * Layout y página renderizan en el mismo request y cada uno hacía su propio
 * `createClient()` + `auth.getUser()`. `getUser()` NO lee la cookie y ya: va a
 * Supabase Auth a validar el token, así que en /admin eran dos viajes de red
 * idénticos (más dos lecturas del rol) antes de pintar nada.
 *
 * Con React `cache()` la primera llamada del árbol hace el trabajo y las demás
 * reciben la MISMA promesa. El alcance es un render de servidor: no se comparte
 * entre usuarios ni entre requests, que es justo lo que tiene que pasar con
 * una sesión.
 *
 * 🔴 SOLO server components (páginas, layouts, generateMetadata). En un route
 * handler o una server action `cache()` no memoiza nada —no hay render— y da
 * igual llamarlo, pero ahí se sigue usando `createClient()` directo.
 *
 * Devuelve el cliente junto con el usuario a propósito: es el mismo cliente
 * ligado a las cookies que cada página creaba a mano, y así nadie arma un
 * segundo cliente para seguir consultando.
 */
export const getUsuario = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
})

/**
 * Rol de la cuenta (`users.role`). Mismo motivo que getUsuario: el layout de
 * /admin y /admin/insights lo consultaban los dos en el mismo request.
 *
 * null si no hay fila o la lectura falla — quien llama lo trata como "no es
 * admin", igual que antes con `profile?.role`.
 */
export const getRol = cache(async (userId: string): Promise<string | null> => {
  const { supabase } = await getUsuario()
  const { data: profile } = await supabase.from('users').select('role').eq('id', userId).single()
  return (profile?.role as string | null | undefined) ?? null
})
