import type { Metadata } from 'next';
import { EmployerApplicationReview } from '@/components/employer/EmployerApplicationReview';
import { loadApplicationEvidenceView } from '@/lib/server/applicationEvidence';
import { loadEmployerWorkflowApplication } from '@/lib/server/employerWorkflow';

export const metadata: Metadata = {
  title: 'Employer application review',
  description: 'Review the exact submitted application packet and separate current Wallet evidence.',
};

export const dynamic = 'force-dynamic';

export default async function EmployerApplicationPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const [workflowResult, evidenceResult] = await Promise.all([
    loadEmployerWorkflowApplication(applicationId),
    loadApplicationEvidenceView(applicationId),
  ]);

  return <EmployerApplicationReview workflowResult={workflowResult} evidenceResult={evidenceResult} />;
}
