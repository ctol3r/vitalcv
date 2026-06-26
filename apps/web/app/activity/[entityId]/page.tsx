import ActivityClient from './ActivityClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  robots: { index: false, follow: false },
  title: 'Activity · VitalCV',
  description: 'The clinician career feed — evidence checks, trust milestones, recognition, and mobility changes.',
};

export default async function ActivityPage({ params }: { params: Promise<{ entityId: string }> }) {
  const { entityId } = await params;
  return <ActivityClient entityId={entityId} />;
}
