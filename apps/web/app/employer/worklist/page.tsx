import { WorklistPanel } from '@/components/verifier/WorklistPanel';
import type { WorklistItem } from '@/lib/verifier/worklist';
import type { ReactElement } from 'react';

const SAMPLE_WORKLIST_ITEMS: WorklistItem[] = [
  {
    clinicianNpi: '1003000126',
    submittedAt: '2026-04-28T16:20:00.000Z',
    status: 'pending',
    proofTier: 'receipt_candidate',
  },
  {
    clinicianNpi: '1234567893',
    submittedAt: '2026-04-27T19:10:00.000Z',
    status: 'in_review',
    proofTier: 'psv_sourced',
  },
  {
    clinicianNpi: '1999999984',
    submittedAt: '2026-04-26T14:35:00.000Z',
    status: 'info_requested',
    proofTier: 'self_attested',
  },
];

export default function EmployerWorklistPage(): ReactElement {
  return (
    <main
      aria-label="Employer worklist shell"
      className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6 lg:px-8"
    >
      <div className="mx-auto grid max-w-6xl gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Employer workflow foundation
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Verifier worklist
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            Worklist is connected to submitted applications. Live DB integration
            is planned.
          </p>
        </div>

        <WorklistPanel items={SAMPLE_WORKLIST_ITEMS} />
      </div>
    </main>
  );
}
