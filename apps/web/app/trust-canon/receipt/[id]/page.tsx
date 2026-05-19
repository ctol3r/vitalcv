/**
 * VitalCV · Trust Surfaces · /receipt/[id]
 *
 * Signed-receipt artifact layout. Uses the inverted-dark SignaturePanel
 * for the cryptographic plane (signer + fingerprint fixture +
 * payload-hash fixture) and the ChainStrip for the receipt chain.
 * The page is a fixture — no live signature verification is performed.
 */

import * as React from 'react';

import {
  SurfaceHeader,
  SurfaceControlFooter,
  type SurfaceControl,
} from '@/components/trust/SurfaceHeader';
import { SignaturePanel } from '@/components/trust/SignaturePanel';
import { ChainStrip } from '@/components/trust/ChainStrip';
import { LineageHeader, VerdictBar } from '@/components/trust/LineageHeader';
import { SectionHeader, DemoBanner } from '@/components/trust/primitives';
import { receiptFixture } from '@/lib/trust/demoData';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReceiptPage({ params }: PageProps) {
  const { id } = await params;
  const receipt = receiptFixture(id);

  const control: SurfaceControl = {
    form: 'VC-RECEIPT-v1',
    title: 'Signed receipt · fixture',
    classification: 'DEMO · FIXTURE',
    effective: receipt.lineage.checkedAtIso,
    revision: 'rev 1 · 2026-05-18',
    controlledBy: 'design fixture · not a live registry',
    state: receipt.lineage.state,
  };

  return (
    <>
      <SurfaceHeader control={control} lineage={receipt.lineage} />
      <DemoBanner extra="No live key, no live registry, no live continuity claim." />

      <main className="t-main">
        <SectionHeader
          n="01"
          title="Receipt lineage"
          ey="reading order is binding"
          right={
            <VerdictBar
              status="Signed fixture"
              sub="design fixture · not a live artifact"
              tone="neutral"
            />
          }
        />
        <LineageHeader lineage={receipt.lineage} />

        <SectionHeader
          n="02"
          title="Cryptographic plane (fixture)"
          ey="inverted surface · reserved for signed planes"
        />
        <SignaturePanel
          signer={receipt.signer}
          payloadHashFixture="fixture:demo-payload-hash-not-a-real-digest"
          caption="The signer label and fingerprint above are fixture-only. The CSS reserves this dark register for the cryptographic plane and no other surface should adopt it."
        />

        <SectionHeader
          n="03"
          title="Receipt chain"
          ey="oldest → newest"
        />
        <ChainStrip
          chain={receipt.chain}
          highlightIndex={receipt.chain.length - 1}
          caption="Demo chain — no node has been signed against a live key."
        />
      </main>

      <SurfaceControlFooter
        control={control}
        runId={receipt.lineage.runId}
      />
    </>
  );
}
