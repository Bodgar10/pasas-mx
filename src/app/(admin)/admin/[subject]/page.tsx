import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import SubjectAdminClient from './subject-admin-client'

interface SectionCount {
  topic_id: string
  theme_id: string | null
  count: number
}

export default async function SubjectAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ subject: string }>
  searchParams: Promise<{ grade?: string; level?: string }>
}) {
  const { subject: subjectSlug } = await params
  const { grade: gradeParam, level } = await searchParams
  const grade = Number(gradeParam ?? 1)

  const supabase = await createClient()

  const getCachedSubject = unstable_cache(
    async (slug: string) => {
      const { data } = await supabase.from('subjects').select('*').eq('slug', slug).single()
      return data
    },
    ['admin-subject', subjectSlug],
    { revalidate: 300, tags: ['subjects'] }
  )

  const getCachedThemes = unstable_cache(
    async () => {
      const { data } = await supabase.from('themes').select('*').eq('active', true)
      return data ?? []
    },
    ['admin-themes'],
    { revalidate: 300, tags: ['themes'] }
  )

  const [subject, themes] = await Promise.all([
    getCachedSubject(subjectSlug),
    getCachedThemes(),
  ])

  if (!subject) return notFound()

  const getCachedTopics = unstable_cache(
    async (subjectId: string, g: number) => {
      const { data } = await supabase
        .from('topics')
        .select('*')
        .eq('subject_id', subjectId)
        .eq('grade', g)
        .order('display_order', { ascending: true })
      return data ?? []
    },
    ['admin-topics', subject.id, String(grade)],
    { revalidate: 300, tags: ['topics'] }
  )

  const topics = await getCachedTopics(subject.id, grade)

  // Batch 3: sections for section counts (needs topic ids)
  const topicIds = (topics ?? []).map((t) => t.id)
  let sectionCounts: SectionCount[] = []

  if (topicIds.length > 0) {
    const { data: sections } = await supabase
      .from('sections')
      .select('topic_id, theme_id')
      .in('topic_id', topicIds)

    if (sections) {
      const countMap: Record<string, Record<string, number>> = {}
      for (const section of sections) {
        const tid = section.topic_id
        const themeKey = section.theme_id ?? 'null'
        if (!countMap[tid]) countMap[tid] = {}
        countMap[tid][themeKey] = (countMap[tid][themeKey] ?? 0) + 1
      }
      for (const [topic_id, themeMap] of Object.entries(countMap)) {
        for (const [themeKey, count] of Object.entries(themeMap)) {
          sectionCounts.push({
            topic_id,
            theme_id: themeKey === 'null' ? null : themeKey,
            count,
          })
        }
      }
    }
  }

  return (
    <SubjectAdminClient
      subject={{ id: subject.id, name: subject.name, slug: subject.slug }}
      topics={topics ?? []}
      themes={themes ?? []}
      sectionCounts={sectionCounts}
      grade={grade}
      level={level ?? ''}
    />
  )
}
