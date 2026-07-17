import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ApplicationEvidenceView } from '@/components/applications/ApplicationEvidenceView';
import { PageFrame } from '@/components/layout/PageFrame';
import { loadApplicationEvidenceView } from '@/lib/server/applicationEvidence';

export const dynamic = 'force-dynamic';

export default async function EmployerReviewPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const evidenceResult = await loadApplicationEvidenceView(applicationId);
  if (evidenceResult.status === 'unauthorized') {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(`/employer/review/${applicationId}`)}`);
  }

  return (
    <main className="mz mz-paper mz-persona-employer min-h-screen">
      <PageFrame mode="workflow" className="space-y-6">
        <Link href="/employer/worklist" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Employer worklist
        </Link>
        <header>
          <p className="mz-eyebrow">Employer review</p>
          <h1 className="mz-h1 mt-2">Application evidence</h1>
          <p className="mt-2 max-w-2xl mz-lede">Review the exact submitted packet and compare it with current Wallet evidence. Employer decisions remain separate.</p>
          <p className="mt-2 break-all font-mono text-xs text-muted-foreground">Application {applicationId}</p>
        </header>
        <ApplicationEvidenceView result={evidenceResult} />
      </PageFrame>
    </main>
  );
}
