'use client';

/**
 * LiveNpiResult — the homepage "I watched it work" moment (Sprint 2).
 *
 * When a clinician submits an NPI, the hero resolves the result IN PLACE instead
 * of routing away: a short progressive check sequence, then the real NPPES
 * identity + a plain-language breakdown (Confirmed today / Needs your attention /
 * Unavailable without access) + one next-best action.
 *
 * Every value is REAL: `/api/identity/bootstrap/{npi}` (NPPES identity) and the
 * public `/api/trust-state/{npi}` (source-check states, blockers, next actions).
 * Nothing is fabricated, and — per the truth contract — no bare "Verified":
 * identity is "confirmed through NPPES", an OIG clear is "no match returned",
 * PECOS not-found and licensure are named as attention / access-required.
 */

import * as React from 'react';
import Link from 'next/link';
import { CheckCircle2, AlertTriangle, Lock, ArrowRight, Fingerprint, RotateCcw } from 'lucide-react';
import {
  CHECK_SEQUENCE,
  SourceCheckNarration,
  useSourceCheckSequence,
  type TrustState,
} from '@/components/readiness/sourceCheckNarration';
import { SOURCE_LANE_OPS } from '@/lib/trust/sourceLanes';

/** Cadence for the exclusion lane, read from the registry rather than typed. */
const OIG_CADENCE =
  SOURCE_LANE_OPS.find((l) => l.laneId === 'oig_exclusions')?.cadenceLabel ?? 'monthly snapshot';

interface Bootstrap {
  firstName?: string;
  lastName?: string;
  specialty?: string;
  state?: string;
  npiType?: string;
}
type Row = { label: string; detail: string };

function titleCaseName(b: Bootstrap): string {
  const raw = [b.firstName, b.lastName].filter(Boolean).join(' ').trim();
  if (!raw) return 'NPI identity located';
  return raw.replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

export function LiveNpiResult({ npi, onReset }: { npi: string; onReset: () => void }) {
  const [boot, setBoot] = React.useState<Bootstrap | null>(null);
  const [trust, setTrust] = React.useState<TrustState | null>(null);
  const { step, phase, finish } = useSourceCheckSequence({ stepCount: CHECK_SEQUENCE.length });

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [bRes, tRes] = await Promise.all([
          fetch(`/api/identity/bootstrap/${npi}`, { cache: 'no-store' }),
          fetch(`/api/trust-state/${npi}`, { cache: 'no-store' }).catch(() => null),
        ]);
        if (!alive) return;
        if (!bRes.ok) {
          finish(false);
          return;
        }
        setBoot((await bRes.json()) as Bootstrap);
        if (tRes && tRes.ok) setTrust((await tRes.json()) as TrustState);
        finish(true);
      } catch {
        if (alive) finish(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [npi, finish]);

  const shell =
    'w-full max-w-sm rounded-[6px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-5 shadow-[0_1px_0_rgba(255,255,255,0.7),0_18px_48px_rgba(15,23,42,0.06)]';

  if (phase === 'error') {
    return (
      <div className={shell}>
        <p className="text-sm font-semibold text-[var(--vt-text-primary)]">We couldn&rsquo;t reach the registry</p>
        <p className="mt-1 text-[13px] text-[var(--vt-text-secondary)]">
          This is a system state, not a finding about NPI {npi}. Check the number and try again.
        </p>
        <button onClick={onReset} className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--vt-text-primary)] underline-offset-4 hover:underline">
          <RotateCcw size={13} aria-hidden="true" /> Try another NPI
        </button>
      </div>
    );
  }

  // ── Resolving: the shared source-check narration ──
  if (phase === 'resolving') {
    return (
      <div className={shell} aria-live="polite">
        <SourceCheckNarration step={step} />
      </div>
    );
  }

  // ── Resolved: real identity + honest breakdown ──
  const confirmed: Row[] = [];
  const attention: Row[] = [];
  const unavailable: Row[] = [];

  if (trust?.identityVerified) confirmed.push({ label: 'Identity', detail: 'Confirmed through the NPPES registry' });
  // The exclusion result carries its cadence. `sourceLanes.ts:68` already
  // requires it — "copy must render cadence, never a blanket 'live'" — and
  // this panel was the surface breaking that rule: a monthly LEIE snapshot
  // rendered under a heading that says "Confirmed today", with no age shown.
  // HHS publishes the LEIE file monthly, so a same-day exclusion cannot be in
  // it, and exclusion status is the one fact where that gap is a liability for
  // an employer acting on the panel. The label comes from the registry so it
  // cannot drift from /api/status or the source ribbon.
  if (trust?.exclusionStatus === 'CLEAR') {
    confirmed.push({
      label: 'OIG exclusions',
      detail: `No match in the current LEIE file (${OIG_CADENCE})`,
    });
  }

  if (trust?.pecosStatus === 'NOT_FOUND') attention.push({ label: 'Medicare enrollment (PECOS)', detail: 'No active enrollment found' });
  for (const b of trust?.blockers ?? []) {
    if (!/pecos/i.test(b)) attention.push({ label: 'Attention', detail: b });
  }

  if (!trust?.licensureStatus || trust.licensureStatus === 'unknown') {
    unavailable.push({ label: 'State licensure', detail: 'State-board source access required' });
  }
  if (trust?.exclusionStatus === 'UNCHECKED') unavailable.push({ label: 'OIG exclusions', detail: 'Check not yet run' });

  const nextAction = trust?.nextActions?.[0];

  return (
    <div className={shell}>
      {/* Identity reveal */}
      <div className="flex items-start gap-3 border-b border-[var(--vt-border-subtle)] pb-4">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] bg-[var(--vt-surface-subtle)] text-[var(--vt-text-primary)]">
          <Fingerprint size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-[var(--vt-text-primary)]">
            {boot ? titleCaseName(boot) : `NPI ${npi}`}
          </p>
          <p className="truncate text-[12px] text-[var(--vt-text-secondary)]">
            {[boot?.specialty, boot?.state].filter(Boolean).join(' · ') || 'NPI identity located'}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-[var(--vt-text-muted)]">NPI {npi} · located in NPPES</p>
        </div>
      </div>

      {confirmed.length > 0 && (
        <Group icon={<CheckCircle2 size={13} className="text-[var(--vt-accent-emerald)]" />} title="Confirmed today" rows={confirmed} />
      )}
      {attention.length > 0 && (
        <Group icon={<AlertTriangle size={13} className="text-[var(--vt-state-stale,#7d5a1e)]" />} title="Needs your attention" rows={attention} />
      )}
      {unavailable.length > 0 && (
        <Group icon={<Lock size={13} className="text-[var(--vt-text-muted)]" />} title="Unavailable without additional access" rows={unavailable} />
      )}

      {/* One next-best action */}
      <div className="mt-4 rounded-[6px] border border-[color-mix(in_oklab,var(--vt-accent-emerald)_28%,transparent)] bg-[color-mix(in_oklab,var(--vt-accent-emerald)_8%,transparent)] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--vt-accent-emerald)]">Best next step</p>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--vt-text-primary)]">
          {nextAction
            ? `${nextAction} — claim your free CV Wallet to preserve this snapshot and keep it moving.`
            : 'Claim your free CV Wallet to preserve this snapshot and complete the missing evidence.'}
        </p>
        <Link
          href="/onboarding"
          className="mt-3 inline-flex items-center gap-1.5 rounded-[4px] px-3.5 py-2 text-[13px] font-semibold text-white"
          style={{ backgroundColor: 'var(--vt-text-primary)' }}
        >
          Claim your Wallet <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>

      <button onClick={onReset} className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--vt-text-muted)] underline-offset-4 hover:text-[var(--vt-text-primary)] hover:underline">
        <RotateCcw size={12} aria-hidden="true" /> Check another NPI
      </button>
      <p className="mt-3 text-[11px] leading-relaxed text-[var(--vt-text-muted)]">
        A public snapshot of what primary sources return today. It is not a completed credentialing decision — institution
        review remains the final step.
      </p>
    </div>
  );
}

function Group({ icon, title, rows }: { icon: React.ReactNode; title: string; rows: Row[] }) {
  return (
    <div className="mt-4">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--vt-text-muted)]">
        {icon}
        {title}
      </p>
      <ul className="mt-2 space-y-1.5">
        {rows.map((r, i) => (
          <li key={`${r.label}-${i}`} className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="text-[var(--vt-text-primary)]">{r.label}</span>
            <span className="text-right text-[12px] text-[var(--vt-text-secondary)]">{r.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
