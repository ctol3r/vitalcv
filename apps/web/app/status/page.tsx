import * as React from 'react';
import type { Metadata } from 'next';

import { buildAdapterMatrix } from '@/lib/authority/adapterMatrix';
import {
  buildStatusFoundationPlan,
  explainStatusSurfaceStatus,
} from '@/lib/commercial/statusFoundation';
import { SourceHealthPublicPanel } from '@/components/status/SourceHealthPublicPanel';
import { getAllSnapshots } from '@/lib/source-health/store/snapshotStore';
import { buildDataClassificationFoundation } from '@/lib/security/dataClassificationFoundation';
import { buildRetentionFoundation } from '@/lib/security/retentionFoundation';

export const metadata: Metadata = {
  title: 'Status · VitalCV',
  description:
    'Status surfaces are foundation previews. No uptime guarantee is implied.',
};

// The snapshot store is module-scope and ephemeral (cold-start resets);
// the page always renders fresh state on each request rather than cache.
export const dynamic = 'force-dynamic';

const COMPLIANCE_DISCLAIMER =
  'This report is a foundation shape for vendor risk assessments. It reflects planned controls, not enforced production policies.';

export default function StatusPage() {
  const plan = buildStatusFoundationPlan();

  // Read-only access to the in-memory snapshot store. Snapshots already
  // contain only safe metadata (sourceId, state, reason, observedAt,
  // lastSuccessAt, lastErrorAt, lastLatencyMs); no raw upstream payloads
  // or PII are stored. If the probe has not run yet (cold-start case),
  // snapshots is [] — the panel renders an honest empty state rather
  // than fabricating green checks.
  let snapshots: ReturnType<typeof getAllSnapshots> = [];
  try {
    snapshots = getAllSnapshots();
  } catch {
    snapshots = [];
  }

  const dataClassification = buildDataClassificationFoundation();
  const retention = buildRetentionFoundation();
  const authority = buildAdapterMatrix();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Status
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          Foundation status preview
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <strong>{`Status surfaces are foundation previews. No uptime guarantee is implied.`}</strong>
          {' '}Incident notices and public changelogs are planned surfaces. Neither is wired today.
        </p>
      </header>

      <SourceHealthPublicPanel snapshots={snapshots} />

      <section
        aria-labelledby="invariants-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="invariants-heading" className="text-base font-semibold sm:text-lg">
          Invariants
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Uptime guarantee implied</dt>
            <dd className="mt-1 font-mono">{String(plan.uptimeGuaranteeImplied)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Production status page live</dt>
            <dd className="mt-1 font-mono">{String(plan.productionStatusPageLive)}</dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="surfaces-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="surfaces-heading" className="text-base font-semibold sm:text-lg">
          Status surfaces
        </h2>
        <ul className="mt-3 space-y-3">
          {plan.surfaces.map((s) => (
            <li key={s.kind} className="text-sm">
              <p className="font-medium">
                {s.label}{' '}
                <span
                  className="ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border-slate-400/40 bg-slate-500/10 text-slate-600"
                  aria-label={`Status: ${s.status}`}
                  title={explainStatusSurfaceStatus(s.status)}
                >
                  {s.status.replace(/_/g, ' ')}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="compliance-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="compliance-heading" className="text-base font-semibold sm:text-lg">
          Compliance evidence (foundation shape)
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          {COMPLIANCE_DISCLAIMER}
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Data classification</dt>
            <dd className="mt-1">
              <p className="font-mono text-xs">redactionLive: {String(dataClassification.redactionLive)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{dataClassification.rules.length} redaction rules</p>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Retention</dt>
            <dd className="mt-1">
              <p className="font-mono text-xs">retentionEnforced: {String(retention.retentionEnforced)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{retention.policies.length} entity policies</p>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Authority adapters</dt>
            <dd className="mt-1">
              <p className="font-mono text-xs">allAdaptersLive: {String(authority.allAdaptersLive)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{authority.adapters.length} adapters</p>
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Machine-readable shape: <code>GET /api/compliance/evidence</code> (same sources).
        </p>
      </section>

      <section
        aria-labelledby="disclaimers-heading"
        className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4 sm:p-5"
      >
        <h2 id="disclaimers-heading" className="text-sm font-semibold">Disclaimers</h2>
        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          {plan.disclaimers.map((d, i) => <li key={i}>· {d}</li>)}
        </ul>
      </section>
    </main>
  );
}
