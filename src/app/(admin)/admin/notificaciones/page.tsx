import { createClient } from '@/utils/supabase/server'
import NotificacionesClient from './notificaciones-client'

export default async function NotificacionesPage() {
  const supabase = await createClient()

  const [{ data: rawTopics }, { data: rawSubjects }, { data: rawBugs }] = await Promise.all([
    supabase
      .from('topic_requests')
      .select('id, topic_name, description, subject_name, grade, education_level, status, created_at, users (full_name, email)')
      .order('created_at', { ascending: false }),
    supabase
      .from('subject_requests')
      .select('id, subject_name, grade, education_level, description, status, created_at, users (full_name, email)')
      .order('created_at', { ascending: false }),
    supabase
      .from('bug_reports')
      .select('id, page_url, description, status, created_at, users (full_name, email)')
      .order('created_at', { ascending: false }),
  ])

  const normalize = (arr: any[]) =>
    (arr ?? []).map((r) => ({ ...r, users: Array.isArray(r.users) ? (r.users[0] ?? null) : r.users }))

  return (
    <NotificacionesClient
      topicRequests={normalize(rawTopics ?? [])}
      subjectRequests={normalize(rawSubjects ?? [])}
      bugReports={normalize(rawBugs ?? [])}
    />
  )
}
