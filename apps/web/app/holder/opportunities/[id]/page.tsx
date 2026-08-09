import type { Metadata } from 'next';
import OpportunityDetailSurface from './OpportunityDetailSurface';

export const metadata: Metadata = {
  title: 'Role Detail',
  description:
    'Role detail with your deterministic match explanation — why you fit, what would strengthen the match, and one-tap apply with your VitalCV.',
};

// Auth + workspace data come from the /holder layout (Clerk gate + provider).
export default async function OpportunityDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  return <OpportunityDetailSurface opportunityId={id} />;
}
