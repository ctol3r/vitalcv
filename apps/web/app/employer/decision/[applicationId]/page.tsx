import { DecisionPanel } from '@/components/verifier/DecisionPanel';
import type { WorklistItem } from '@/lib/verifier/worklist';
import type { ReactElement } from 'react';

const MOCK_DECISION_ITEM: WorklistItem = {
  clinicianNpi: '1999999984',
  submittedAt: '2026-04-26T14:35:00.000Z',
  status: 'info_requested',
  proofTier: 'self_attested',
};

export default async function EmployerDecisionPage(props: {
  params: Promise<{ applicationId: string }>;
}): Promise<ReactElement> {
  const { applicationId } = await props.params;

  return (
    <main
      aria-label="Employer decision shell"
      className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6 lg:px-8"
    >
      <div className="mx-auto grid max-w-5xl gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Employer workflow foundation
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Decision shell
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            Decision recording is planned for the production workflow.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
          <p className="font-semibold text-slate-950">Read-only outcome area</p>
          <p className="mt-1">
            Application <span className="font-mono">{applicationId}</span> has
            no persisted decision outcome in this shell.
          </p>
        </div>

        <DecisionPanel item={MOCK_DECISION_ITEM} />
      </div>
    </main>
  );
}
