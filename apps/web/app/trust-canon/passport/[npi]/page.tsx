/**
 * VitalCV · Trust Surfaces · /passport/[npi]
 *
 * Holder passport / readiness surface. Demo fixture only — no live
 * source resolution, no Prisma read. The page composes the canonical
 * primitives and renders a labelled fixture.
 */

import * as React from 'react';

import {
  SurfaceHeader,
  SurfaceControlFooter,
  type SurfaceControl,
} from '@/components/trust/SurfaceHeader';
import { DegradedRow } from '@/components/trust/DegradedRow';
import { SectionHeader, DemoBanner, Mono } from '@/components/trust/primitives';
import { DEGRADED_ROWS, passportFixture } from '@/lib/trust/demoData';

interface PageProps {
  params: Promise<{ npi: string }>;
}

export default async function PassportPage({ params }: PageProps) {
  const { npi } = await params;
  const lineage = passportFixture(npi);

  const control: SurfaceControl = {
    form: 'VC-PASSPORT-v1',
    title: 'Clinician readiness preview',
    classification: 'DEMO · FIXTURE',
    effective: lineage.checkedAtIso,
    revision: 'rev 1 · 2026-05-18',
    controlledBy: 'design fixture · not a live registry',
    state: lineage.state,
  };

  return (
    <>
      <SurfaceHeader control={control} lineage={lineage} />
      <DemoBanner extra="Pilot intake is designed to reject PHI; do not submit patient data." />

      <main className="t-main">
        <SectionHeader
          n="01"
          title="Readiness lanes (preview)"
          ey="source-backed preview · no live decision"
        />
        <ul className="t-degraded-list" data-testid="trust-degraded-list">
          {DEGRADED_ROWS.map((entry) => (
            <DegradedRow key={`${entry.reason}-${entry.laneLabel}`} entry={entry} />
          ))}
        </ul>

        <SectionHeader
          n="02"
          title="Receipt-shaped artifact (preview)"
          ey="how the holder sees their own packet"
        />
        <div className="t-receipt-preview">
          <p className="t-receipt-preview-copy">
            This passport renders the readiness packet shape only. No
            real receipt has been signed for{' '}
            <Mono>{npi}</Mono>. The brief explicitly forbids live
            signature verification claims in this surface.
          </p>
        </div>
      </main>

      <SurfaceControlFooter
        control={control}
        runId={lineage.runId}
        page="01 / 01"
      />
    </>
  );
}
