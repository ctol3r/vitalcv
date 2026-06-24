import ActivityClient from './ActivityClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Activity · VitalCV',
  description: 'The clinician career feed — evidence verified, trust milestones, recognition, and mobility changes.',
};

export default async function ActivityPage({ params }: { params: Promise<{ entityId: string }> }) {
  const { entityId } = await params;
  return <ActivityClient entityId={entityId} />;
}
