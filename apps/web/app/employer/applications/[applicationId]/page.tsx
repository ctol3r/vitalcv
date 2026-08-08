import type { Metadata } from 'next';
import { EmployerApplicationReview } from '@/components/employer/EmployerApplicationReview';
import { loadApplicationEvidenceView } from '@/lib/server/applicationEvidence';
import { loadEmployerWorkflowApplication } from '@/lib/server/employerWorkflow';
import { loadEmployerHandoff } from '@/lib/server/handoffReceipt';

export const metadata: Metadata = {
  title: 'Employer application review',
  description: 'Review the exact submitted application packet, current profile evidence, and immutable handoff receipts.',
};

export const dynamic = 'force-dynamic';

export default async function EmployerApplicationPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const [workflowResult, evidenceResult, handoffResult] = await Promise.all([
    loadEmployerWorkflowApplication(applicationId),
    loadApplicationEvidenceView(applicationId),
    loadEmployerHandoff(applicationId),
  ]);

  return (
    <EmployerApplicationReview
      workflowResult={workflowResult}
      evidenceResult={evidenceResult}
      handoffResult={handoffResult}
    />
  );
}
