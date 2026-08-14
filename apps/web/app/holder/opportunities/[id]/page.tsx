import type { Metadata } from 'next';
import OpportunityDetailSurface from './OpportunityDetailSurface';
import '@/styles/opportunity-detail.css';

export const metadata: Metadata = {
  title: 'Role Detail',
  description:
    'Review why a clinical role may fit, what evidence gaps and uncertainty remain, and choose the next step.',
};

// Auth + workspace data come from the /holder layout (Clerk gate + provider).
export default async function OpportunityDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  return <OpportunityDetailSurface opportunityId={id} />;
}
