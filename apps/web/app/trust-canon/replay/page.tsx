/**
 * VitalCV · Trust Surfaces · /replay
 *
 * Replay memory / chronology — chain strip plus chronological receipt
 * nodes. No marketing copy. Every node is a fixture.
 */

import * as React from 'react';

import {
  SurfaceHeader,
  SurfaceControlFooter,
  type SurfaceControl,
} from '@/components/trust/SurfaceHeader';
import { ChainStrip } from '@/components/trust/ChainStrip';
import { SectionHeader, DemoBanner, Mono } from '@/components/trust/primitives';
import { replayFixture } from '@/lib/trust/demoData';
import { lineageWhen } from '@/lib/trust/format';

export default async function ReplayPage() {
  const receipts = replayFixture();
  const newest = receipts[receipts.length - 1];
  const now = new Date();
  const when = lineageWhen(newest.lineage.checkedAtIso, now);

  const control: SurfaceControl = {
    form: 'VC-REPLAY-v1',
    title: 'Replay memory · chronology',
    classification: 'DEMO · FIXTURE',
    effective: when.checkedAtIso,
    revision: 'rev 1 · 2026-05-18',
    controlledBy: 'design fixture · not a live registry',
    state: 'snapshot',
  };

  const chain = receipts.map((r) => r.id);

  return (
    <>
      <SurfaceHeader control={control} lineage={newest.lineage} />
      <DemoBanner extra="No live continuity claim is made by this surface." />

      <main className="t-main">
        <SectionHeader
          n="01"
          title="Chain strip"
          ey="oldest → newest · all nodes are fixtures"
        />
        <ChainStrip
          chain={chain}
          highlightIndex={chain.length - 1}
          caption="Each node is a design-fixture receipt id; no node has been signed against a live key."
        />

        <SectionHeader
          n="02"
          title="Chronological nodes"
          ey="receipt-shaped artifacts · in order"
        />
        <ol className="t-replay-nodes" data-testid="trust-replay-nodes">
          {receipts.map((r, i) => (
            <li
              key={r.id}
              className="t-replay-node"
              data-testid="trust-replay-node"
              data-index={i}
            >
              <div className="t-replay-node-l">
                <span className="t-replay-node-idx mono">
                  {i.toString().padStart(2, '0')}
                </span>
                <span className="t-replay-node-id">
                  <Mono>{r.id}</Mono>
                </span>
              </div>
              <div className="t-replay-node-r">
                <span className="t-replay-node-when mono">
                  {r.lineage.checkedAgo}
                </span>
                <span className="t-replay-node-channel mono">
                  {r.lineage.channel}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </main>

      <SurfaceControlFooter control={control} runId={newest.lineage.runId} />
    </>
  );
}
