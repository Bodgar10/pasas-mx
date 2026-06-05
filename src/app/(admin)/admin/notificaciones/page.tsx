import { createClient } from '@/utils/supabase/server'
import NotificacionesClient from './notificaciones-client'

export default async function NotificacionesPage() {
  const supabase = await createClient()

  const { data: requests } = await supabase
    .from('topic_requests')
    .select(`
      id, topic_name, description, subject_name, grade,
      education_level, status, admin_notes, created_at,
      users (full_name, email)
    `)
    .order('created_at', { ascending: false })

  return <NotificacionesClient requests={requests ?? []} />
}
