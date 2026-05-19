/**
 * VitalCV · Trust Surfaces · /verify/[receipt]
 *
 * Verifier reading mode. The page's 30-second answer is:
 *
 *   who asserted · what source · when checked · ownership · replay ·
 *   run_id · receipt status
 *
 * All of which the LineageHeader already renders in the canonical
 * reading order. The verdict bar adds the receipt-status line —
 * "Replay-ready" / "Signed fixture" / "Source-backed preview" /
 * "Receipt-shaped artifact" — never bare "Verified".
 */

import * as React from 'react';

import {
  SurfaceHeader,
  SurfaceControlFooter,
  type SurfaceControl,
} from '@/components/trust/SurfaceHeader';
import { LineageHeader, VerdictBar } from '@/components/trust/LineageHeader';
import {
  SectionHeader,
  DemoBanner,
  Mono,
} from '@/components/trust/primitives';
import { verifyFixture } from '@/lib/trust/demoData';

interface PageProps {
  params: Promise<{ receipt: string }>;
}

export default async function VerifyPage({ params }: PageProps) {
  const { receipt } = await params;
  const lineage = verifyFixture(receipt);

  const control: SurfaceControl = {
    form: 'VC-VERIFY-v1',
    title: 'Verifier reading mode',
    classification: 'DEMO · FIXTURE',
    effective: lineage.checkedAtIso,
    revision: 'rev 1 · 2026-05-18',
    controlledBy: 'design fixture · not a live registry',
    state: lineage.state,
  };

  return (
    <>
      <SurfaceHeader control={control} lineage={lineage} />
      <DemoBanner extra="No live signature verification is performed by this surface." />

      <main className="t-main">
        <SectionHeader
          n="01"
          title="Verdict (fixture)"
          ey="receipt-shaped artifact · not a live verification"
          right={
            <VerdictBar
              status="Source-backed preview"
              sub="receipt is a fixture · no continuity claim"
              tone="neutral"
            />
          }
        />
        <div className="t-verify-summary">
          <LineageHeader lineage={lineage} />
        </div>

        <SectionHeader
          n="02"
          title="What the verifier answers in 30 seconds"
          ey="binding reading order"
        />
        <ul className="t-verify-list">
          <li>
            <span className="mono">who_asserted</span> · the
            controlled-document header above (see <Mono>controlled_by</Mono>).
          </li>
          <li>
            <span className="mono">what_source</span> · channel cell{' '}
            <Mono>{lineage.channel}</Mono>.
          </li>
          <li>
            <span className="mono">when_checked</span> ·{' '}
            <Mono>{lineage.checkedAgo}</Mono>{' '}
            (<Mono>{lineage.checkedAtIso}</Mono>).
          </li>
          <li>
            <span className="mono">ownership</span> · explicit{' '}
            <Mono>{lineage.ownership}</Mono> — never implicit.
          </li>
          <li>
            <span className="mono">replay</span> · <Mono>{lineage.replay}</Mono>.
          </li>
          <li>
            <span className="mono">run_id</span> · <Mono>{lineage.runId}</Mono>.
          </li>
        </ul>
      </main>

      <SurfaceControlFooter control={control} runId={lineage.runId} />
    </>
  );
}
