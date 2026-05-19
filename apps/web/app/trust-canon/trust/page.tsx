/**
 * VitalCV · Trust Surfaces · /trust
 *
 * The trust state register — the doctrinal surface that documents
 * the three states (preview / snapshot / signed), the binding
 * reading order, the ownership taxonomy, the five failure modes,
 * and the degraded-row semantics. The register is itself a
 * controlled document; it wears the same SurfaceHeader as every
 * other trust surface.
 */

import * as React from 'react';

import {
  SurfaceHeader,
  SurfaceControlFooter,
  type SurfaceControl,
} from '@/components/trust/SurfaceHeader';
import { LineageHeader } from '@/components/trust/LineageHeader';
import { DegradedRow } from '@/components/trust/DegradedRow';
import { FailureBanner } from '@/components/trust/FailureBanner';
import {
  SectionHeader,
  DemoBanner,
  StateStamp,
  OwnershipBadge,
  Mono,
} from '@/components/trust/primitives';
import {
  DEGRADED_ROWS,
  FAILURE_MODES,
  trustRegisterFixture,
} from '@/lib/trust/demoData';
import { LINEAGE_READING_ORDER } from '@/lib/trust/types';

export default async function TrustRegisterPage() {
  const { preview, snapshot, signed } = trustRegisterFixture();

  const control: SurfaceControl = {
    form: 'VC-TRUST-STATE-v1',
    title: 'Trust state · visual register',
    classification: 'PUBLIC · DOCTRINE (demo fixture)',
    effective: signed.checkedAtIso,
    revision: 'rev 1 · 2026-05-18',
    controlledBy: 'design fixture · not a live registry',
    state: 'signed',
  };

  return (
    <>
      <SurfaceHeader control={control} lineage={signed} />
      <DemoBanner extra="No live signature, no live key, no live customer." />

      <main className="t-main">
        {/* ── 01 · Three states at the same scale ────────────────── */}
        <SectionHeader
          n="01"
          title="Three states · at the same scale"
          ey="same content · different register"
        />
        <div className="t-register-stage" data-testid="trust-register-stage">
          <article className="t-register-card" data-state="preview">
            <StateStamp state="preview" caption="A" />
            <LineageHeader lineage={preview} />
          </article>
          <article className="t-register-card" data-state="snapshot">
            <StateStamp state="snapshot" caption="B" />
            <LineageHeader lineage={snapshot} />
          </article>
          <article className="t-register-card" data-state="signed">
            <StateStamp state="signed" caption="C" />
            <LineageHeader lineage={signed} />
          </article>
        </div>

        {/* ── 02 · Reading order is binding ─────────────────────── */}
        <SectionHeader
          n="02"
          title="Reading order is binding"
          ey="Object → Ownership → checked_at → Channel → Replay → run_id"
        />
        <ol className="t-reading-order" data-testid="trust-reading-order">
          {LINEAGE_READING_ORDER.map((id, i) => (
            <li
              key={id}
              data-order-index={i}
              data-cell={id}
              className="t-reading-order-item"
            >
              <span className="t-reading-order-n mono">
                {(i + 1).toString().padStart(2, '0')}
              </span>
              <span className="t-reading-order-id mono">{id}</span>
            </li>
          ))}
        </ol>

        {/* ── 03 · Ownership taxonomy ─────────────────────────── */}
        <SectionHeader
          n="03"
          title="Ownership taxonomy"
          ey="three values · no implicit ownership"
        />
        <ul className="t-ownership-list" data-testid="trust-ownership-list">
          <li>
            <OwnershipBadge state="subject" />
            <span className="t-ownership-copy">
              The asserting party IS the subject.
            </span>
          </li>
          <li>
            <OwnershipBadge state="delegated" />
            <span className="t-ownership-copy">
              An operator is reading on behalf of the subject under a
              documented delegation.
            </span>
          </li>
          <li>
            <OwnershipBadge state="unbound" />
            <span className="t-ownership-copy">
              No subject binding has been established yet.
            </span>
          </li>
        </ul>

        {/* ── 04 · Failure modes A–E ──────────────────────────── */}
        <SectionHeader
          n="04"
          title="Failure modes · A through E"
          ey="documented refusals · never system errors"
        />
        <div
          className="t-failure-grid"
          data-testid="trust-failure-grid"
        >
          {FAILURE_MODES.map((descriptor) => (
            <FailureBanner key={descriptor.mode} descriptor={descriptor} />
          ))}
        </div>

        {/* ── 05 · Degraded row semantics ─────────────────────── */}
        <SectionHeader
          n="05"
          title="Degraded row semantics"
          ey="dashed border · never opacity"
        />
        <ul className="t-degraded-list" data-testid="trust-register-degraded-list">
          {DEGRADED_ROWS.map((entry) => (
            <DegradedRow
              key={`${entry.reason}-${entry.laneLabel}`}
              entry={entry}
            />
          ))}
        </ul>

        {/* ── 06 · What this register does NOT claim ─────────── */}
        <SectionHeader
          n="06"
          title="What this register does not claim"
          ey="explicit non-claims"
        />
        <ul className="t-nonclaims" data-testid="trust-nonclaims">
          <li>
            No live signature verification is performed by any surface
            in this group.
          </li>
          <li>
            No live <Mono>did:web:vitalcv.health</Mono> registry is
            queried; the controlled-by field is a fixture string.
          </li>
          <li>
            No customer cohort, no SLA, no AES claim, no deletion
            receipt is asserted.
          </li>
          <li>
            No HIPAA, SOC 2, NCQA, HITRUST, or BAA claim is implied by
            this surface.
          </li>
        </ul>
      </main>

      <SurfaceControlFooter
        control={control}
        runId={signed.runId}
        page="01 / 01"
      />
    </>
  );
}
