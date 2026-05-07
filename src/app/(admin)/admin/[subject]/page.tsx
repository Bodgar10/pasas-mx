import { notFound } from 'next/navigation'
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

  // Batch 1: subject + themes in parallel (independent)
  const [{ data: subject }, { data: themes }] = await Promise.all([
    supabase.from('subjects').select('*').eq('slug', subjectSlug).single(),
    supabase.from('themes').select('*').eq('active', true),
  ])

  if (!subject) return notFound()

  // Batch 2: topics (needs subject.id)
  const { data: topics } = await supabase
    .from('topics')
    .select('*')
    .eq('subject_id', subject.id)
    .eq('grade', grade)
    .order('display_order', { ascending: true })

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
