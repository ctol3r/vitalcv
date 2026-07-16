'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Loader2, PartyPopper } from 'lucide-react';

import { ProofContinuityRail, type ProofLane } from '@/components/vital/ProofContinuityRail';
import { SkeletonStack } from '@/components/vital/SkeletonStack';
import type { EvidenceState } from '@/lib/vital/evidenceState';

/**
 * OnboardingReadiness — the final step of the canonical activation flow. After
 * the NPI is bound, this streams the source checks IN PLACE (no bounce to
 * /holder/readiness), renders the shared ProofContinuityRail, states the one
 * next-best action, and ends with "Your VitalCV Wallet is ready."
 *
 * Every value is REAL (public /api/trust-state/{npi}); the honest mapping mirrors
 * the homepage LiveNpiResult (identityVerified → source-backed, OIG CLEAR →
 * checked, PECOS not-found → needs review, licensure unknown → access required).
 * Nothing here is a completed credentialing decision.
 */
interface TrustState {
  identityVerified?: boolean;
  exclusionStatus?: string; // CLEAR | EXCLUDED | UNCHECKED
  pecosStatus?: string; // ENROLLED | NOT_FOUND | UNKNOWN
  licensureStatus?: string; // unknown | ...
  blockers?: string[];
  nextActions?: string[];
}

const CHECK_SEQUENCE = [
  'Recognizing your identity',
  'Checking federal exclusion data (OIG)',
  'Checking Medicare enrollment (PECOS)',
  'Preparing your readiness snapshot',
] as const;

export function trustStateToLanes(trust: TrustState | null): ProofLane[] {
  const lane = (id: string, label: string, state: EvidenceState, why?: string): ProofLane => ({ id, label, state, why });
  const lanes: ProofLane[] = [];

  lanes.push(
    lane(
      'nppes',
      'NPPES identity',
      trust?.identityVerified ? 'source_backed' : 'access_required',
      'The anchor every other check hangs on.',
    ),
  );

  const exclusion: EvidenceState =
    trust?.exclusionStatus === 'CLEAR' ? 'checked' : trust?.exclusionStatus === 'EXCLUDED' ? 'needs_review' : 'unavailable';
  lanes.push(lane('oig', 'OIG / LEIE exclusions', exclusion, 'Federal exclusion source.'));

  const pecos: EvidenceState =
    trust?.pecosStatus === 'ENROLLED' ? 'source_backed' : trust?.pecosStatus === 'NOT_FOUND' ? 'needs_review' : 'unavailable';
  lanes.push(lane('pecos', 'Medicare enrollment (PECOS)', pecos, 'Enrollment status from CMS.'));

  const licensure: EvidenceState = trust?.licensureStatus && trust.licensureStatus !== 'unknown' ? 'checked' : 'access_required';
  lanes.push(lane('state', 'State licensure', licensure, 'State-board source access required.'));

  return lanes;
}

export function OnboardingReadiness({ npi }: { npi: string }) {
  const [step, setStep] = React.useState(0);
  const [trust, setTrust] = React.useState<TrustState | null>(null);
  const [phase, setPhase] = React.useState<'resolving' | 'ready' | 'error'>('resolving');

  React.useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const t = window.setInterval(() => setStep((s) => Math.min(s + 1, CHECK_SEQUENCE.length)), 600);
    return () => window.clearInterval(t);
  }, []);

  React.useEffect(() => {
    let alive = true;
    const started = Date.now();
    (async () => {
      try {
        const res = await fetch(`/api/trust-state/${npi}`, { cache: 'no-store' });
        if (!alive) return;
        if (res.ok) setTrust((await res.json()) as TrustState);
        const wait = Math.max(0, 1800 - (Date.now() - started));
        window.setTimeout(() => {
          if (!alive) return;
          setStep(CHECK_SEQUENCE.length);
          setPhase(res.ok ? 'ready' : 'error');
        }, wait);
      } catch {
        if (alive) setPhase('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [npi]);

  if (phase === 'resolving') {
    return (
      <div className="mt-6 text-left" aria-live="polite">
        <p className="mz-eyebrow">Reading primary sources</p>
        <ul className="mt-3 space-y-2.5">
          {CHECK_SEQUENCE.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={label} className="flex items-center gap-2.5 text-[13px]">
                {done ? (
                  <CheckCircle2 size={15} className="shrink-0 text-[var(--vt-accent-emerald)]" aria-hidden="true" />
                ) : active ? (
                  <Loader2 size={15} className="shrink-0 animate-spin text-[var(--vt-text-muted)]" aria-hidden="true" />
                ) : (
                  <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-[var(--vt-border)]" aria-hidden="true" />
                )}
                <span className={done ? 'text-[var(--vt-text-primary)]' : 'text-[var(--vt-text-secondary)]'}>{label}</span>
              </li>
            );
          })}
        </ul>
        <SkeletonStack rows={4} className="mt-5" aria-label="Preparing your readiness snapshot" />
      </div>
    );
  }

  const lanes = trustStateToLanes(trust);
  const nextAction = trust?.nextActions?.[0] ?? 'Add your state license number to strengthen your readiness.';

  return (
    <div className="mt-6 text-left">
      <div className="flex items-center gap-2 text-[var(--vt-accent-emerald)]">
        <PartyPopper size={18} aria-hidden="true" />
        <p className="text-[15px] font-semibold text-[var(--vt-text-primary)]">Your VitalCV Wallet is ready.</p>
      </div>
      <p className="mt-1 text-[13px] text-[var(--vt-text-secondary)]">
        A source-backed snapshot of where you stand today. It is not a completed credentialing decision — institution
        review remains the final step.
      </p>

      <ProofContinuityRail lanes={lanes} className="mt-4" heading="Your readiness" />

      {phase === 'error' && (
        <p className="mt-2 text-[12px] text-[var(--vt-text-muted)]">
          Some sources couldn&rsquo;t be reached just now — that&rsquo;s a system state, not a finding. Your wallet still
          opens; the lanes refresh when the sources respond.
        </p>
      )}

      <div className="mt-4 rounded-[8px] border border-[color-mix(in_oklab,var(--vt-accent-emerald)_28%,transparent)] bg-[color-mix(in_oklab,var(--vt-accent-emerald)_8%,transparent)] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--vt-accent-emerald)]">Best next step</p>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--vt-text-primary)]">{nextAction}</p>
      </div>

      <Link
        href="/holder"
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[4px] px-4 py-3 text-[14px] font-semibold text-white"
        style={{ backgroundColor: 'var(--vt-text-primary)' }}
      >
        Open your Wallet <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </div>
  );
}

export default OnboardingReadiness;
