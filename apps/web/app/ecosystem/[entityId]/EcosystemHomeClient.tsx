'use client';

/**
 * Ecosystem Home (Wave 300, D1) — the operating system for a healthcare career.
 *
 * Composes the merged data layers (evidence / trust / mobility / organizations /
 * timeline) into a single 60-second view that answers: What do I have? Where am I?
 * What's next? Who is connected to me? Read-only; honest about decision-grade vs
 * gated/stale (status comes verbatim from the trust layer).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type {
  EvidenceCollection,
  MobilityOverview,
  OrganizationGraph,
  ReadinessProjection,
  TimelineProjection,
  TrustProjection,
} from '@vitalcv/domain-evidence';
import { fetchJson } from '@/lib/workspace/fetch-json';
import { WorkspaceNav } from '@/components/workspace/WorkspaceNav';

interface EcosystemData {
  evidence: EvidenceCollection;
  trust: TrustProjection;
  timeline: TimelineProjection;
  mobility: MobilityOverview;
  readiness: ReadinessProjection;
  organizations: OrganizationGraph;
}

const READINESS_TONE: Record<string, string> = {
  ready: 'text-emerald-700',
  near_ready: 'text-amber-700',
  blocked: 'text-rose-700',
  unknown: 'text-muted-foreground',
};

const STANDING_TONE: Record<string, string> = {
  established: 'text-emerald-700',
  emerging: 'text-sky-700',
  provisional: 'text-amber-700',
  unknown: 'text-muted-foreground',
};

function Card({ title, eyebrow, children, href }: { title: string; eyebrow?: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-2 flex items-baseline justify-between">
        <div>
          {eyebrow && <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{eyebrow}</p>}
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
        {href && <Link href={href} className="text-xs text-muted-foreground hover:text-foreground">View →</Link>}
      </div>
      {children}
    </section>
  );
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function EcosystemHomeClient({ entityId }: { entityId: string }) {
  const [data, setData] = useState<EcosystemData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      // Single composite call: the passport is resolved once server-side (Wave 400 C1).
      const snapshot = await fetchJson<EcosystemData>(`/api/ecosystem/${encodeURIComponent(entityId)}`);
      if (cancelled) return;
      setData(
        snapshot && snapshot.evidence && snapshot.trust && snapshot.timeline && snapshot.mobility && snapshot.readiness && snapshot.organizations
          ? snapshot
          : null,
      );
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [entityId]);

  if (loading) {
    return <main className="mx-auto w-full max-w-4xl px-4 py-16"><p role="status" aria-live="polite" className="text-sm text-muted-foreground">Loading career ecosystem…</p></main>;
  }
  if (!data) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-lg font-semibold text-foreground">Ecosystem not available</h1>
        <p className="text-sm text-muted-foreground">Run a readiness check to generate this clinician&apos;s source-backed career snapshot.</p>
        <Link href="/passport" className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background">Check readiness</Link>
      </main>
    );
  }

  const { evidence, trust, timeline, mobility, readiness, organizations } = data;
  const name = evidence.generatedFor.displayName || 'Clinician';
  const rep = timeline.reputation;
  const decisionGradeDimensions = trust.dimensions.filter((d) => d.score !== null && d.score > 0);
  const recentEvents = [...timeline.events].reverse().slice(0, 5);

  return (
    <main className="min-h-screen bg-background">
      <WorkspaceNav entityId={entityId} active="ecosystem" />
      <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6">
        {/* Header — Career Health (answers "where am I?") */}
        <header className="rounded-2xl border border-border bg-card p-6">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Career Ecosystem</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">{name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span>
              Career health:{' '}
              <span className={`font-semibold capitalize ${STANDING_TONE[rep.standing] ?? ''}`}>{rep.standing}</span>
              {rep.overallTrust !== null && <span className="text-muted-foreground"> · trust {rep.overallTrust}</span>}
            </span>
            <span className="text-muted-foreground">Trend: {rep.trend}</span>
            <span className="text-muted-foreground">{rep.decisionGradeEvidence}/{rep.totalEvidence} evidence source-backed</span>
          </div>
        </header>

        {/* Status row — Evidence / Trust / Mobility */}
        <div className="grid gap-4 sm:grid-cols-3">
          {/* What do I have? */}
          <Card title="Evidence" eyebrow="What do I have?">
            <p className="text-2xl font-semibold tabular-nums text-foreground">{evidence.objects.length}</p>
            <p className="text-xs text-muted-foreground">{rep.decisionGradeEvidence} decision-grade</p>
            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {Object.entries(evidence.byClass).filter(([, v]) => v.length > 0).slice(0, 4).map(([cls, v]) => (
                <li key={cls} className="flex justify-between"><span className="capitalize">{cls.replace('_', ' ')}</span><span>{v.length}</span></li>
              ))}
            </ul>
          </Card>

          {/* Where am I? (trust) */}
          <Card title="Trust" eyebrow="Where am I?">
            <p className={`text-2xl font-semibold capitalize ${STANDING_TONE[rep.standing] ?? ''}`}>{rep.standing}</p>
            <p className="text-xs text-muted-foreground">{decisionGradeDimensions.length} active dimensions</p>
            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {decisionGradeDimensions.slice(0, 4).map((d) => (
                <li key={d.dimension} className="flex justify-between"><span className="capitalize">{d.dimension}</span><span>{d.score}</span></li>
              ))}
            </ul>
          </Card>

          {/* What's next? (mobility) */}
          <Card title="Mobility" eyebrow="What's next?">
            <p className={`text-2xl font-semibold capitalize ${READINESS_TONE[readiness.readiness] ?? ''}`}>{readiness.readiness.replace('_', ' ')}</p>
            <p className="text-xs text-muted-foreground">{mobility.licensedStates.length ? `Licensed: ${mobility.licensedStates.join(', ')}` : 'No decision-grade licenses'}</p>
            <p className="mt-2 text-xs text-muted-foreground">{readiness.rationale}</p>
          </Card>
        </div>

        {/* Organizations — Who is connected to me? */}
        <Card title="Organizations" eyebrow="Who is connected to me?" href={`/network/${encodeURIComponent(entityId)}`}>
          {organizations.organizations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No source-backed organizations yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {organizations.organizations.slice(0, 8).map((o) => (
                <span key={o.id} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs">
                  <span className="text-foreground">{o.label}</span>
                  <span className="text-muted-foreground">· {o.kind.replace('_', ' ')}</span>
                </span>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Activity */}
        <Card title="Recent Activity" href={`/activity/${encodeURIComponent(entityId)}`}>
          {recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recorded activity yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentEvents.map((e) => (
                <li key={e.eventId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-foreground">{e.label}</span>
                  <span className="text-xs text-muted-foreground">{e.type.replace(/_/g, ' ')} · {formatDate(e.occurredAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <p className="text-xs text-muted-foreground">
          Source coverage is reported honestly as checked, gated, stale, or unknown — never as a guarantee. Decision-grade reflects current source-backed verification only.
        </p>
      </div>
    </main>
  );
}
