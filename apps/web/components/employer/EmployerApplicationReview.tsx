import Link from 'next/link';
import { ArrowLeft, FileCheck2, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApplicationEvidenceView } from '@/components/applications/ApplicationEvidenceView';
import { EmployerHandoffReceiptCard } from '@/components/employer/EmployerHandoffReceiptCard';
import { HireToStartCasePanel } from '@/components/applications/HireToStartCasePanel';
import { EmployerDecisionControls } from '@/components/employer/EmployerDecisionControls';
import {
  employerWorkflowStateLabel,
  employerWorkflowStateTone,
  relativeTimestamp,
  type EmployerWorkflowApplication,
} from '@/lib/employer-workflow';
import type { ApplicationEvidenceLoadResult } from '@/lib/applications/evidenceView';
import type { EmployerWorkflowLoadResult } from '@/lib/server/employerWorkflow';
import type { EmployerHandoffLoadResult } from '@/lib/server/handoffReceipt';
import type { HireToStartLoadResult } from '@/lib/applications/hireToStart';

function clinicianName(application: EmployerWorkflowApplication): string {
  return application.provider?.fullName ?? (application.npi ? `NPI ${application.npi}` : 'Clinician');
}

function workflowError(result: EmployerWorkflowLoadResult): string | null {
  if (result.status === 'ok') return null;
  if (result.status === 'not_found') return 'This application is not available to your organization.';
  if (result.status === 'unauthorized') return 'Sign in with an authorized employer account to review this application.';
  return result.message;
}

/**
 * Employer packet review remains read-only. Handoff receipts expose transport
 * truth without implying review, acceptance, credentialing, privileging or start.
 */
export function EmployerApplicationReview({
  workflowResult,
  evidenceResult,
  handoffResult,
  hireToStartResult,
}: {
  workflowResult: EmployerWorkflowLoadResult;
  evidenceResult: ApplicationEvidenceLoadResult;
  /** Optional only for retained pre-Phase-2 render fixtures. Runtime pages supply it. */
  handoffResult?: EmployerHandoffLoadResult;
  /** Optional only for retained pre-hire-to-start render fixtures. Runtime pages supply it. */
  hireToStartResult?: HireToStartLoadResult;
}) {
  const workflow = workflowResult.status === 'ok' ? workflowResult.data : null;
  const error = workflowError(workflowResult);
  const resolvedHandoffResult: EmployerHandoffLoadResult = handoffResult ?? { status: 'not_found' };
  const resolvedHireToStartResult: HireToStartLoadResult = hireToStartResult ?? { status: 'not_found' };

  return (
    <main className="min-h-screen bg-[#08101d] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/employer/applications" className="inline-flex items-center gap-2 text-sm text-white/65 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Employer applications
        </Link>

        {workflow ? (
          <header className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.24)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/80">Authorized employer review</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight">{clinicianName(workflow)}</h1>
                <p className="mt-2 text-sm text-white/65">
                  {workflow.opportunity.title} · {workflow.opportunity.state} · submitted {relativeTimestamp(workflow.createdAt)}
                </p>
              </div>
              <Badge className={employerWorkflowStateTone(workflow.workflowState)} variant="outline">
                {employerWorkflowStateLabel(workflow.workflowState)}
              </Badge>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-white/45">Employer</p>
                <p className="mt-2 text-sm font-medium text-white">{workflow.employer.name ?? 'Organization name unavailable'}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-white/45">Readiness</p>
                <p className="mt-2 text-sm font-medium text-white">
                  {workflow.readiness ? `${workflow.readiness.readinessLevel} · ${workflow.readiness.readinessScore}/100` : 'Unavailable'}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-white/45">Open clarification requests</p>
                <p className="mt-2 text-sm font-medium text-white">{workflow.missingRequests.filter((request) => request.status === 'OPEN').length}</p>
              </div>
            </div>
          </header>
        ) : (
          <Card className="border-amber-400/30 bg-amber-400/10 text-amber-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-50"><ShieldAlert className="h-5 w-5" />Employer review unavailable</CardTitle>
              <CardDescription className="text-amber-50/80">{error}</CardDescription>
            </CardHeader>
          </Card>
        )}

        <EmployerHandoffReceiptCard result={resolvedHandoffResult} />

        <HireToStartCasePanel result={resolvedHireToStartResult} variant="employer" />

        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 sm:p-6">
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-emerald-50">
            <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p className="text-sm leading-6">
              Review the exact submitted packet below. Current profile evidence is shown separately and never replaces the clinician’s original presentation.
            </p>
          </div>
          <ApplicationEvidenceView result={evidenceResult} />
        </section>

        {resolvedHireToStartResult.status === 'ok' ? <EmployerDecisionControls data={resolvedHireToStartResult.data} /> : null}
      </div>
    </main>
  );
}
