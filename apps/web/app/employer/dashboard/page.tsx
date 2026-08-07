import type { ReactElement } from 'react';
import Link from 'next/link';

import { LaneHealthMount } from '@/components/source-health/LaneHealthMount';
import { PageFrame } from '@/components/layout/PageFrame';
import { Reveal } from '@/components/motion/Reveal';
import { getWorklist } from '@/lib/verifier/worklistRepo';
import type { WorklistReviewState } from '@/lib/verifier/worklistRepo';

/**
 * Employer dashboard — the VERIFIER role-landing surface (ROLE_LANDING.VERIFIER).
 *
 * W0.3 (truth lock). This route previously rendered hard-coded operational data
 * to ANY visitor: application counts (12/5/3/8/2), a "Time to Credential: 4.2
 * days avg" figure, "OIG Checks Delayed: 2 applications stuck", and invented
 * application IDs (#1029, #1030). None of it came from a query. The route
 * answered 200 unauthenticated and was linked from the public /employers page
 * ("Already set up? Open your workspace"), so a prospect could read invented
 * operational metrics as live customer data.
 *
 * Every number below is now a count of real ReceiptCandidate rows. When the
 * table is empty the page says so. There is no fake-fill, and no derived
 * "time to credential" — VitalCV has not measured one.
 *
 * Known limitation, stated in the UI: this reads every row in the table.
 * Org-scoping within the verifier surface is a later wave (see worklistRepo's
 * truth contract). Route-level access is enforced by PROTECTED_ROUTES
 * (/employer/* → VERIFIER).
 */

export const dynamic = 'force-dynamic';

const REVIEW_STATES: Array<{ state: WorklistReviewState; label: string }> = [
  { state: 'pending', label: 'Pending' },
  { state: 'in_review', label: 'In review' },
  { state: 'info_requested', label: 'Information requested' },
  { state: 'acceptable_for_start', label: 'Acceptable for start' },
  { state: 'unable_to_verify', label: 'Unable to verify' },
];

export default async function EmployerDashboardPage(): Promise<ReactElement> {
  let counts = new Map<WorklistReviewState, number>();
  let total = 0;
  let dbError = false;

  try {
    const rows = await getWorklist({ reviewState: 'all', limit: 500 });
    total = rows.length;
    counts = rows.reduce((acc, row) => {
      acc.set(row.reviewState, (acc.get(row.reviewState) ?? 0) + 1);
      return acc;
    }, new Map<WorklistReviewState, number>());
  } catch {
    dbError = true;
  }

  return (
    <main
      aria-label="Employer dashboard"
      className="mz mz-paper mz-persona-employer min-h-screen"
    >
      <PageFrame mode="workflow" className="mz-ambient grid gap-6">
        <Reveal variant="fade">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-3">
              <p className="mz-eyebrow">Employer workflow</p>
              <h1 className="mz-h1">Dashboard</h1>
              <p className="max-w-2xl mz-lede">
                Counts below are read from submitted receipt candidates. Every
                candidate carries a review state, never a completion score.
                Org-scoping within this surface is still in progress.
              </p>
            </div>
            <Link href="/employer/post" className="mz-btn mz-btn-primary">
              Post a job
            </Link>
          </div>
        </Reveal>

        {dbError && (
          <p
            role="alert"
            className="rounded-[3px] border border-[var(--watch-rule)] bg-[var(--watch-bg)] px-4 py-3 text-sm text-[var(--watch)]"
          >
            Database unavailable. Candidate counts cannot be displayed at this
            time.
          </p>
        )}

        <Reveal delay={80}>
          <section aria-labelledby="candidates-by-state" className="grid gap-3">
            <h2 id="candidates-by-state" className="mz-h2">
              Candidates by review state
            </h2>

            {!dbError && total === 0 ? (
              <p className="mz-lede max-w-2xl">
                No receipt candidates have been submitted yet. Counts appear here
                once an application reaches review.
              </p>
            ) : (
              <ul className="grid gap-2">
                {REVIEW_STATES.map(({ state, label }) => (
                  <li
                    key={state}
                    className="flex justify-between border-b border-[var(--mz-rule)] py-2"
                  >
                    <span>{label}</span>
                    <span className="font-mono tabular-nums">
                      {dbError ? '—' : (counts.get(state) ?? 0)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Reveal>

        <Reveal delay={160}>
          <LaneHealthMount heading="Source operational state (employer view)" />
        </Reveal>
      </PageFrame>
    </main>
  );
}
