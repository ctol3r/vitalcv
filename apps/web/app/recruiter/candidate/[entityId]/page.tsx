import RecruiterCandidateClient from './RecruiterCandidateClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Candidate Review · VitalCV',
  description: 'Recruiter candidate review — placement readiness, evidence, trust, and background, source-backed.',
};

export default async function RecruiterCandidatePage({ params }: { params: Promise<{ entityId: string }> }) {
  const { entityId } = await params;
  return <RecruiterCandidateClient entityId={entityId} />;
}
