'use client';

/**
 * MATCHA Opportunity Simulator — deterministic "what if" impact.
 *
 * Fetches /api/matcha/simulate/[npi] and shows the credential moves that would
 * unlock the most of the clinician's REAL live roles. Every number is the
 * matching engine's own recomputed output over real opportunities — no
 * estimates, no invented AI. Honest states: no NPI / nothing to unlock / a
 * system-unavailable state are all distinct and never presented as findings.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Loader2, Sparkles } from 'lucide-react';

interface CredentialScenario {
  id: string;
  credentialKey: string;
  label: string;
  jobsUnlocked: number;
  clearedAfter: number;
  avgScoreDelta: number;
  basis: string;
}

interface SimResult {
  totalOpportunities: number;
  baselineCleared: number;
  scenarios: CredentialScenario[];
}

type Phase =
  | { s: 'loading' }
  | { s: 'ready'; data: SimResult }
  | { s: 'empty' }
  | { s: 'unavailable' };

export function OpportunitySimulator({ npi }: { npi: string | null }) {
  const [phase, setPhase] = useState<Phase>({ s: 'loading' });

  useEffect(() => {
    let cancelled = false;
    if (!npi) {
      setPhase({ s: 'empty' });
      return;
    }
    setPhase({ s: 'loading' });
    void (async () => {
      try {
        const res = await fetch(`/api/matcha/simulate/${encodeURIComponent(npi)}`, {
          cache: 'no-store',
        });
        if (cancelled) return;
        if (!res.ok) {
          setPhase({ s: 'unavailable' });
          return;
        }
        const data = (await res.json()) as SimResult;
        if (!data || !Array.isArray(data.scenarios) || data.scenarios.length === 0) {
          setPhase({ s: 'empty' });
          return;
        }
        setPhase({ s: 'ready', data });
      } catch {
        if (!cancelled) setPhase({ s: 'unavailable' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [npi]);

  return (
    <section className="vcv-panel p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: 'var(--accent, #0f766e)' }} aria-hidden />
          <div>
            <p className="vcv-eyebrow">What if — improve your MATCH</p>
            <h2 className="vcv-title text-xl mt-0.5">The fastest ways to unlock more roles</h2>
          </div>
        </div>
      </div>

      {phase.s === 'loading' && (
        <div className="flex items-center gap-2 text-sm vcv-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Re-scoring your live roles…
        </div>
      )}

      {phase.s === 'empty' && (
        <p className="text-sm vcv-muted">
          {npi
            ? 'No credential is currently gating your matched roles — nothing to unlock right now.'
            : 'Add your NPI to simulate how new credentials would change your matches.'}
        </p>
      )}

      {phase.s === 'unavailable' && (
        <p className="text-sm" style={{ color: 'var(--state-blocked, #b91c1c)' }}>
          The simulator is temporarily unavailable — a system state, not a finding about your record.
        </p>
      )}

      {phase.s === 'ready' && (
        <>
          <p className="text-xs vcv-subtle">
            Baseline: {phase.data.baselineCleared} of {phase.data.totalOpportunities} live roles cleared to
            apply. Each move below re-scores all {phase.data.totalOpportunities}.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {phase.data.scenarios.slice(0, 6).map((s) => (
              <ScenarioCard key={s.id} scenario={s} />
            ))}
          </div>
          <p className="text-xs vcv-subtle border-t pt-3" style={{ borderColor: 'var(--hairline, #e3e7e3)' }}>
            Every projection re-scores your own real live roles with the credential added — deterministic, not
            an estimate. Earning a credential is verified separately; this only shows how matching would change.
          </p>
        </>
      )}
    </section>
  );
}

function ScenarioCard({ scenario }: { scenario: CredentialScenario }) {
  const headline =
    scenario.jobsUnlocked > 0
      ? `+${scenario.jobsUnlocked} role${scenario.jobsUnlocked === 1 ? '' : 's'} ready`
      : `+${scenario.avgScoreDelta} match strength`;
  const sub =
    scenario.jobsUnlocked > 0 && scenario.avgScoreDelta > 0
      ? `· +${scenario.avgScoreDelta} avg match`
      : null;

  return (
    <Link
      href="/holder/readiness"
      className="group flex flex-col gap-1.5 rounded-lg p-3 transition-colors"
      style={{ border: '1px solid var(--hairline, #e3e7e3)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          {scenario.label}
        </span>
        <ArrowUpRight className="h-3.5 w-3.5 opacity-40 transition-opacity group-hover:opacity-80" aria-hidden />
      </div>
      <p className="vcv-title text-lg leading-none" style={{ color: 'var(--accent, #0f766e)' }}>
        {headline} <span className="text-xs font-normal vcv-subtle">{sub}</span>
      </p>
      <p className="text-[11px] vcv-subtle leading-relaxed">{scenario.basis}</p>
    </Link>
  );
}
