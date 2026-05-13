import type { ReactElement } from 'react';
import { getWorklist } from '@/lib/verifier/worklistRepo';
import type { WorklistDbRow } from '@/lib/verifier/worklistRepo';
import { WorklistPanel } from '@/components/verifier/WorklistPanel';
import type { WorklistItem } from '@/lib/verifier/worklist';

// NPI is not stored on ReceiptCandidate (a future wave adds that lookup).
// candidateId is used as the identifier in the panel until then.
function toWorklistItem(row: WorklistDbRow): WorklistItem {
  return {
    clinicianNpi: row.candidateId,
    submittedAt: row.createdAt.toISOString(),
    status: row.reviewState,
    proofTier: 'receipt_candidate',
  };
}

export default async function EmployerWorklistPage(): Promise<ReactElement> {
  // DB-backed read. Returns [] when the table is empty — no fake-fill.
  // Org-scope and RBAC gating are deferred to a later wave.
  let items: WorklistItem[] = [];
  let dbError = false;

  try {
    const rows = await getWorklist({ limit: 100 });
    items = rows.map(toWorklistItem);
  } catch {
    dbError = true;
  }

  return (
    <main
      aria-label="Employer worklist"
      className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6 lg:px-8"
    >
      <div className="mx-auto grid max-w-6xl gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Employer workflow
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Verifier worklist
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            Showing receipt candidates from the database. Org-scoping and role
            gating are in progress.
          </p>
        </div>

        {dbError && (
          <p
            role="alert"
            className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          >
            Database unavailable. The worklist cannot be displayed at this time.
          </p>
        )}

        <WorklistPanel items={items} />
      </div>
    </main>
  );
}
