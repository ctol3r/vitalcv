'use client';

/**
 * Recruiter Candidate Review (Wave 310) — composes the merged evidence/trust/
 * mobility/organizations APIs into a recruiter placement decision. Read-only;
 * does NOT touch the pre-existing employer-review/candidates/workspace backend.
 *
 * Answers the recruiter's questions: Is this candidate ready? Where can I place
 * them? What backs them? Verdict is derived honestly — "move forward" requires a
 * decision-grade ready/established candidate; missing/gated coverage degrades.
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
import { RECRUITER_VERDICT_LABEL, deriveRecruiterVerdict, type RecruiterVerdict } from '@/lib/recruiter/candidate-verdict';

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { cache: 'no-store' });
  return res.ok ? ((await res.json()) as T) : null;
}

interface Data {
  evidence: EvidenceCollection;
  trust: TrustProjection;
  mobility: MobilityOverview;
  readiness: ReadinessProjection;
  organizations: OrganizationGraph;
  timeline: TimelineProjection;
}

const VERDICT_TONE: Record<RecruiterVerdict, string> = {
  move_forward: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  request_evidence: 'border-amber-300 bg-amber-50 text-amber-800',
  not_ready: 'border-rose-300 bg-rose-50 text-rose-800',
  insufficient: 'border-slate-300 bg-slate-50 text-slate-700',
};

export default function RecruiterCandidateClient({ entityId }: { entityId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  // Per-state placement check
  const [stateInput, setStateInput] = useState('');
  const [stateResult, setStateResult] = useState<ReadinessProjection | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const id = encodeURIComponent(entityId);
      const [evidence, trust, mobility, readiness, organizations, timeline] = await Promise.all([
        fetchJson<EvidenceCollection>(`/api/evidence/${id}`),
        fetchJson<TrustProjection>(`/api/graph/${id}/trust`),
        fetchJson<MobilityOverview>(`/api/mobility/${id}`),
        fetchJson<ReadinessProjection>(`/api/mobility/${id}/readiness`),
        fetchJson<OrganizationGraph>(`/api/organizations/${id}`),
        fetchJson<TimelineProjection>(`/api/timeline/${id}`),
      ]);
      if (cancelled) return;
      setData(evidence && trust && mobility && readiness && organizations && timeline ? { evidence, trust, mobility, readiness, organizations, timeline } : null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [entityId]);

  async function checkState() {
    const s = stateInput.trim().toUpperCase();
    if (!/^[A-Za-z]{2}$/.test(s)) return;
    setChecking(true);
    const r = await fetchJson<ReadinessProjection>(`/api/mobility/${encodeURIComponent(entityId)}/readiness?state=${s}`);
    setStateResult(r);
    setChecking(false);
  }

  if (loading) return <main className="mx-auto w-full max-w-3xl px-4 py-16"><p className="text-sm text-muted-foreground">Loading candidate…</p></main>;
  if (!data) return <main className="mx-auto w-full max-w-3xl px-4 py-16"><p className="text-sm text-muted-foreground">Candidate not available.</p></main>;

  const { evidence, trust, mobility, organizations } = data;
  const standing = data.timeline.reputation.standing;
  const verdict = deriveRecruiterVerdict(data.readiness.readiness, standing);
  const name = evidence.generatedFor.displayName || 'Candidate';
  const missing = evidence.coverageSummary.gated.concat(evidence.coverageSummary.stale, evidence.coverageSummary.notDecisionGrade ?? []);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-10">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Candidate Review</p>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">{name}</h1>
            <p className="mt-1 text-sm text-muted-foreground capitalize">Trust standing: {standing} · {trust.overall.decisionGradeEvidence}/{trust.overall.totalEvidence} source-backed</p>
          </div>
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${VERDICT_TONE[verdict]}`} data-testid="recruiter-verdict">
            {RECRUITER_VERDICT_LABEL[verdict]}
          </span>
        </header>

        {/* Placement readiness */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-2 text-sm font-semibold text-foreground">Placement readiness</h2>
          <p className="text-sm text-muted-foreground">
            Ready now in: <span className="text-foreground">{mobility.licensedStates.length ? mobility.licensedStates.join(', ') : 'no decision-grade licenses'}</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="state-check">Check placement state</label>
            <input id="state-check" value={stateInput} onChange={(e) => setStateInput(e.target.value)} maxLength={2}
              placeholder="State (e.g. NV)" className="h-9 w-32 rounded-full border border-border bg-background px-3 text-sm uppercase outline-none focus:border-foreground" />
            <button type="button" onClick={() => void checkState()} disabled={checking}
              className="h-9 rounded-full border border-border px-4 text-sm text-foreground disabled:opacity-50">
              {checking ? 'Checking…' : 'Check placement'}
            </button>
            {stateResult && (
              <span className="text-sm capitalize text-muted-foreground">
                → <span className="font-medium text-foreground">{stateResult.readiness.replace('_', ' ')}</span>
                {stateResult.fixableGaps.length ? ` (${stateResult.fixableGaps.length} fixable)` : ''}
              </span>
            )}
          </div>
        </section>

        {/* Evidence + trust */}
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Evidence</h2>
            <p className="text-2xl font-semibold tabular-nums text-foreground">{trust.overall.decisionGradeEvidence}<span className="text-sm font-normal text-muted-foreground">/{evidence.objects.length} decision-grade</span></p>
            {missing.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Owed: {missing.join(', ')}</p>}
          </section>
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Trust dimensions</h2>
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {trust.dimensions.filter((d) => d.score !== null && d.score > 0).slice(0, 5).map((d) => (
                <li key={d.dimension} className="flex justify-between"><span className="capitalize">{d.dimension}</span><span>{d.score}</span></li>
              ))}
            </ul>
          </section>
        </div>

        {/* Background */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-2 text-sm font-semibold text-foreground">Background</h2>
          {organizations.organizations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No source-backed organizations.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {organizations.organizations.map((o) => (
                <span key={o.id} className="rounded-full border border-border px-2.5 py-1 text-xs text-foreground">{o.label} <span className="text-muted-foreground">· {o.kind.replace('_', ' ')}</span></span>
              ))}
            </div>
          )}
        </section>

        <footer className="flex flex-wrap gap-4 border-t border-border pt-4 text-sm">
          <Link href={`/packet/${encodeURIComponent(entityId)}`} className="text-foreground hover:underline">Full proof packet →</Link>
          <Link href={`/ecosystem/${encodeURIComponent(entityId)}`} className="text-muted-foreground hover:text-foreground">Career ecosystem →</Link>
          <span className="text-xs text-muted-foreground">Verdict is source-backed and policy-dependent — acceptance remains the employer&apos;s decision.</span>
        </footer>
      </div>
    </main>
  );
}
