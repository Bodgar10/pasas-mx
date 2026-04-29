import { createClient } from '@/utils/supabase/server'
import AdminHomeClient from './admin-home-client'

export default async function AdminHomePage() {
  const supabase = await createClient()

  const { data: subjects } = await supabase
    .from('subjects')
    .select('id, name, slug, education_level, grades, icon, display_order')
    .order('education_level', { ascending: true })
    .order('display_order', { ascending: true })

  return <AdminHomeClient subjects={subjects ?? []} />
}
