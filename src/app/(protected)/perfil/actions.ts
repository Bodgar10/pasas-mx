'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionState = { error?: string; success?: string } | null

export async function updateNameAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const fullName = (formData.get('full_name') as string)?.trim()
  if (!fullName) return { error: 'El nombre no puede estar vacío.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  const { error } = await supabase.from('users').update({ full_name: fullName }).eq('id', user.id)
  if (error) return { error: 'Error al actualizar el nombre.' }

  revalidatePath('/perfil')
  return { success: 'Nombre actualizado correctamente.' }
}

export async function updateEmailAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = (formData.get('email') as string)?.trim()
  if (!email) return { error: 'El correo no puede estar vacío.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ email })
  if (error) return { error: 'Error al actualizar el correo. Verifica que sea válido.' }

  return { success: 'Te enviamos un correo de confirmación al nuevo email.' }
}

export async function updatePasswordAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string

  if (password.length < 6) return { error: 'La contraseña debe tener al menos 6 caracteres.' }
  if (password !== confirm) return { error: 'Las contraseñas no coinciden.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: 'Error al actualizar la contraseña.' }

  return { success: 'Contraseña actualizada correctamente.' }
}

export async function cancelSubscriptionAction(
  _prev: ActionState,
  _formData: FormData
): Promise<ActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('provider_sub_id')
    .eq('user_id', user.id)
    .in('status', ['active', 'trialing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!subscription?.provider_sub_id) return { error: 'No se encontró una suscripción activa.' }

  try {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    await stripe.subscriptions.update(subscription.provider_sub_id, {
      cancel_at_period_end: true,
    })
    revalidatePath('/perfil')
    return { success: 'Tu suscripción se cancelará al final del período actual. Seguirás teniendo acceso hasta entonces.' }
  } catch {
    return { error: 'Error al cancelar la suscripción. Intenta de nuevo.' }
  }
}
