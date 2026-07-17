import type { ReactElement } from 'react';
import { getWorklist } from '@/lib/verifier/worklistRepo';
import type { WorklistDbRow } from '@/lib/verifier/worklistRepo';
import { WorklistPanel } from '@/components/verifier/WorklistPanel';
import type { WorklistItem } from '@/lib/verifier/worklist';
import { Reveal } from '@/components/motion/Reveal';
import { PageFrame } from '@/components/layout/PageFrame';

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
      className="mz mz-paper mz-persona-employer min-h-screen"
    >
      <PageFrame mode="workflow" className="mz-ambient grid gap-6">
        <Reveal variant="fade">
          <div className="flex flex-col gap-3">
            <p className="mz-eyebrow">
              Employer workflow
            </p>
            <h1 className="mz-h1">
              Verifier worklist
            </h1>
            <p className="max-w-2xl mz-lede">
              Showing receipt candidates from the database. Org-scoping and role
              gating are in progress.
            </p>
          </div>
        </Reveal>

        {dbError && (
          <p
            role="alert"
            className="rounded-[3px] border border-[var(--watch-rule)] bg-[var(--watch-bg)] px-4 py-3 text-sm text-[var(--watch)]"
          >
            Database unavailable. The worklist cannot be displayed at this time.
          </p>
        )}

        <Reveal delay={80}>
          <WorklistPanel items={items} />
        </Reveal>
      </PageFrame>
    </main>
  );
}
