'use client'

import TrainingCoursePage from '@/components/career/TrainingCoursePage'

export default function CoursePage({ params }: { params: { id: string } }) {
  return <TrainingCoursePage courseId={params.id} />
}

