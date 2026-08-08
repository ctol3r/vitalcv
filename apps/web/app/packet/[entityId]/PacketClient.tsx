'use client';

/**
 * Career Packet read-only surface (Wave 205, W205-2).
 *
 * Renders the ten packet sections from the shared derivation layer
 * (lib/packet/career-packet.ts) — the SAME model the PDF consumes. No auth
 * redesign, no wallet dependency, no mutations: this is a read-only snapshot of
 * an already-computed passport, honest about gated / stale / missing coverage.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchPassportEntity } from '@/lib/api';
import { buildEmployerProofPacketDownloadUrl } from '@/lib/export/employer-proof-packet';
import {
  buildCareerPacket,
  type CareerPacketModel,
  type RecruiterStatus,
} from '@/lib/packet/career-packet';
import type { PassportData } from '@/lib/trust/passport-contract';

function formatTimestamp(value: string | null): string {
  if (!value) return 'Unavailable';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(parsed);
}

const RECRUITER_TONE: Record<RecruiterStatus, string> = {
  ready: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  needs_review: 'border-amber-300 bg-amber-50 text-amber-800',
  blocked: 'border-rose-300 bg-rose-50 text-rose-800',
  missing_evidence: 'border-slate-300 bg-slate-50 text-slate-700',
};

function Section({
  title,
  children,
  eyebrow,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-none sm:p-6">
      {eyebrow && (
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {eyebrow}
        </p>
      )}
      <h2 className="mb-3 text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function PacketBody({ model }: { model: CareerPacketModel }) {
  const npi = model.generatedFor.npi;
  const exportUrl = npi && /^\d{10}$/.test(npi) ? buildEmployerProofPacketDownloadUrl(npi) : null;
  const exportReady = model.recruiter.status === 'ready';

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
      {/* Header + recruiter status — the <30s scan */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Source-backed Clinician Career Packet
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">{model.executive.who}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{model.executive.verdict}</p>
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${RECRUITER_TONE[model.recruiter.status]}`}
            data-testid="recruiter-status"
          >
            {model.recruiter.label}
          </span>
        </div>
        {model.footer.degraded && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
            Partial snapshot — some sources were unavailable at check time. Readiness is shown honestly as it stands now.
          </div>
        )}
      </header>

      {/* 1. Executive Summary */}
      <Section title="Executive Summary" eyebrow="1">
        <p className="text-sm text-foreground">{model.executive.headline}</p>
        <p className="mt-2 text-sm text-muted-foreground">{model.recruiter.headline}</p>
      </Section>

      {/* 2. Identity */}
      <Section title="Identity" eyebrow="2">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">NPI</dt>
            <dd className="font-mono text-foreground">{model.identity.npi ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Specialty</dt>
            <dd className="text-foreground">{model.identity.specialty ?? 'Unavailable'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt>
            <dd className="text-foreground">{model.identity.status}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">{model.identity.sourceLabel}</p>
      </Section>

      {/* 3. Readiness */}
      <Section title="Credential Readiness" eyebrow="3">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-3xl font-semibold tabular-nums text-foreground">{model.readiness.score}</span>
          <span className="text-sm text-muted-foreground">{model.readiness.statusLabel}</span>
          {model.readiness.estimatedStartDays != null && (
            <span className="text-sm text-muted-foreground">
              · Est. time-to-start: {model.readiness.estimatedStartDays} day{model.readiness.estimatedStartDays === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {model.readiness.blockers.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-rose-700">
            {model.readiness.blockers.map((b) => <li key={b}>{b}</li>)}
          </ul>
        )}
      </Section>

      {/* 4. Verification Sources */}
      <Section title="Verification Sources" eyebrow="4">
        {model.sources.length === 0 ? (
          <EmptyState>No source checks are attached to this record yet.</EmptyState>
        ) : (
          <div className="divide-y divide-border">
            {model.sources.map((s) => (
              <div key={s.sourceId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="font-mono text-sm text-foreground">{s.sourceId}</p>
                  <p className="text-xs text-muted-foreground">{s.reason}</p>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-foreground">
                    {s.stateLabel}
                  </span>
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatTimestamp(s.checkedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 5. Evidence */}
      <Section title="Evidence" eyebrow="5">
        {!model.evidence.hasAny ? (
          <EmptyState>No source-backed credential or training evidence on file yet.</EmptyState>
        ) : (
          <div className="space-y-3 text-sm">
            {model.evidence.credentials.map((c, i) => (
              <div key={`cred-${i}`} className="flex items-center justify-between gap-2">
                <span className="text-foreground">{c.label}{c.jurisdiction ? ` · ${c.jurisdiction}` : ''}</span>
                <span className="text-xs text-muted-foreground">{c.stale ? 'Stale' : c.status}</span>
              </div>
            ))}
            {model.evidence.training.map((t, i) => (
              <div key={`train-${i}`} className="flex items-center justify-between gap-2">
                <span className="text-foreground">{t.label}{t.institutionName ? ` · ${t.institutionName}` : ''}</span>
                <span className="text-xs text-muted-foreground">{t.endYear ?? ''}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 6. Recruiter View */}
      <Section title="Recruiter View" eyebrow="6">
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${RECRUITER_TONE[model.recruiter.status]}`}
        >
          {model.recruiter.label}
        </span>
        {model.recruiter.reasons.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {model.recruiter.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        )}
      </Section>

      {/* 7. Employer View */}
      <Section title="Employer View" eyebrow="7">
        <p className="text-sm font-medium text-foreground">{model.employer.startReadyLabel}</p>
        {model.employer.blockers.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-rose-700">
            {model.employer.blockers.map((b) => <li key={b}>{b}</li>)}
          </ul>
        )}
        {model.employer.requestItems.length > 0 && (
          <>
            <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">Request to move forward</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {model.employer.requestItems.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </>
        )}
      </Section>

      {/* 8. Trust Signals */}
      <Section title="Trust Signals" eyebrow="8">
        {!model.trustSignals ? (
          <EmptyState>Trust posture is not available for this record.</EmptyState>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {model.trustSignals.bandLabel} · score {model.trustSignals.score}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {model.trustSignals.dimensions.map((d) => (
                <div key={d.id} className="rounded-xl border border-border px-3 py-2">
                  <p className="text-sm font-medium text-foreground">{d.label}</p>
                  <p className="text-xs text-muted-foreground">{d.detail}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>

      {/* 9. Missing Evidence */}
      <Section title="Missing Evidence" eyebrow="9">
        {model.missingEvidence.length === 0 ? (
          <EmptyState>No outstanding evidence gaps on the checked launch-spine sources.</EmptyState>
        ) : (
          <ul className="space-y-2 text-sm">
            {model.missingEvidence.map((m, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-foreground">{m.label}</span>
                <span className="text-xs text-muted-foreground">{m.stateLabel}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 10. Recommendations */}
      <Section title="Recommendations" eyebrow="10">
        {model.recommendations.length === 0 ? (
          <EmptyState>No recommended actions — readiness is current.</EmptyState>
        ) : (
          <ul className="space-y-2 text-sm">
            {model.recommendations.map((r, i) => (
              <li key={i} className="rounded-xl border border-border px-3 py-2">
                <p className="font-medium text-foreground">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Export + footer */}
      <footer className="space-y-3 border-t border-border pt-5">
        {exportUrl ? (
          exportReady ? (
            <a
              href={exportUrl}
              className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background"
              data-testid="packet-export"
            >
              Download Career Packet (PDF)
            </a>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="packet-export-gated">
              PDF export unlocks once readiness is source-backed and blockers are resolved.
            </p>
          )
        ) : null}
        <p className="font-mono text-[11px] text-muted-foreground">
          {model.footer.lineageKey ? `lineage: ${model.footer.lineageKey} · ` : ''}
          checked {formatTimestamp(model.footer.lastCheckedAt)}
        </p>
        <p className="text-xs text-muted-foreground">
          Source coverage is reported as checked, gated, stale, or unknown — never as a guarantee. Acceptance is verifier-policy dependent.
        </p>
      </footer>
    </div>
  );
}

export default function PacketClient({ entityId }: { entityId: string }) {
  const [passport, setPassport] = useState<PassportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const result = await fetchPassportEntity(entityId);
      if (cancelled) return;
      setPassport(result.ok && result.body ? result.body : null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [entityId]);

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-16">
        <p className="text-sm text-muted-foreground">Loading career packet…</p>
      </main>
    );
  }

  if (!passport) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-lg font-semibold text-foreground">Packet not available</h1>
        <p className="text-sm text-muted-foreground">
          This record hasn&apos;t been generated yet. Run a readiness check to open the source-backed snapshot.
        </p>
        <Link
          href="/onboarding"
          className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background"
        >
          Check readiness
        </Link>
      </main>
    );
  }

  const model = buildCareerPacket(passport);
  return (
    <main className="min-h-screen bg-background">
      <PacketBody model={model} />
    </main>
  );
}
