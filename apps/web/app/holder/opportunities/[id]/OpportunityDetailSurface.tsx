'use client';
import { CaptureInWorkbench } from '@/components/workbench/CaptureInWorkbench';

/**
 * OpportunityDetailSurface — the role detail page for a signed-in clinician.
 *
 * Primary source is the live mobile workspace feed (the same
 * MobileOpportunityCard the list renders, including the MATCHA match
 * explanation). When the role is not in the clinician's matched feed (deep
 * link, or the role closed), it falls back to GET /api/opportunities/[id]
 * and renders honestly without match data.
 *
 * Apply reuses the existing, tested flow: the list's ?apply=<id> query param
 * opens ApplyModal with optimistic provider updates — no second apply path.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PageFrame } from '@/components/layout/PageFrame';
import {
  ArrowLeft,
  Banknote,
  Building2,
  ChevronRight,
  Loader2,
  MapPin,
  Stethoscope,
} from 'lucide-react';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import type { MobileOpportunityCard } from '@/lib/mobile/dashboard';

type FallbackState = 'idle' | 'loading' | 'not_found' | 'error';

interface FallbackOpportunity {
  id: string;
  organizationName: string;
  title: string;
  specialty: string;
  state: string;
  hiringType: string | null;
  payRange: string | null;
  description: string | null;
  remote: boolean;
  status: string | null;
}

function toFallbackOpportunity(value: unknown): FallbackOpportunity | null {
  if (!value || typeof value !== 'object') return null;
  const raw = (value as { opportunity?: unknown }).opportunity ?? value;
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.title !== 'string') return null;
  const str = (key: string): string | null => (typeof o[key] === 'string' ? (o[key] as string) : null);
  return {
    id: o.id,
    organizationName: str('organizationName') ?? 'Organization not listed',
    title: o.title,
    specialty: str('specialty') ?? 'Specialty not listed',
    state: str('state') ?? '—',
    hiringType: str('hiringType'),
    payRange: str('payRange'),
    description: str('description'),
    remote: o.remote === true,
    status: str('status'),
  };
}

function matchBandLabel(band: string): string {
  switch (band) {
    case 'CLEAR':
      return 'Strong match';
    case 'NEAR_CLEAR':
      return 'Almost ready';
    case 'PARTIAL':
      return 'Partial fit';
    default:
      return 'Not eligible yet';
  }
}

function matchBandTone(band: string): string {
  switch (band) {
    case 'CLEAR':
      return 'mz-chip mz-chip-ok';
    // "Almost ready" is not fully clear — amber, matching the opportunity feed
    // (ClinicianPanels.matchTone) so one band never shows two colors.
    case 'NEAR_CLEAR':
    case 'PARTIAL':
      return 'mz-chip mz-chip-watch';
    default:
      return 'mz-chip mz-chip-unknown';
  }
}

export default function OpportunityDetailSurface({ opportunityId }: { opportunityId: string }) {
  const { data } = useClinicianMobile();

  const card: MobileOpportunityCard | null = useMemo(
    () => data.opportunities.find((opportunity) => opportunity.id === opportunityId) ?? null,
    [data.opportunities, opportunityId],
  );

  const [fallback, setFallback] = useState<FallbackOpportunity | null>(null);
  const [fallbackState, setFallbackState] = useState<FallbackState>('idle');

  useEffect(() => {
    if (card) return;
    let cancelled = false;

    async function loadFallback() {
      setFallbackState('loading');
      try {
        const res = await fetch(`/api/opportunities/${encodeURIComponent(opportunityId)}`, {
          cache: 'no-store',
        });
        if (cancelled) return;
        if (res.status === 404) {
          setFallbackState('not_found');
          return;
        }
        if (!res.ok) {
          setFallbackState('error');
          return;
        }
        const payload: unknown = await res.json();
        if (cancelled) return;
        const parsed = toFallbackOpportunity(payload);
        if (parsed) {
          setFallback(parsed);
          setFallbackState('idle');
        } else {
          setFallbackState('not_found');
        }
      } catch {
        if (!cancelled) setFallbackState('error');
      }
    }

    void loadFallback();
    return () => {
      cancelled = true;
    };
  }, [card, opportunityId]);

  /* ── Fallback loading ── */
  if (!card && fallbackState === 'loading') {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-16" role="status" aria-live="polite">
          <Loader2 className="h-7 w-7 animate-spin text-[var(--ink-400)]" aria-hidden />
          <p className="mz-small">Loading role…</p>
        </div>
      </Shell>
    );
  }

  /* ── Not found ── */
  if (!card && fallbackState === 'not_found') {
    return (
      <Shell>
        <BackLink />
        <div className="space-y-4 py-12 text-center">
          <h1 className="mz-h1">This role is no longer available</h1>
          <p className="mz-body">
            It may have been filled or withdrawn by the employer. Your matched feed always shows
            what is live right now.
          </p>
          <Link
            href="/holder/opportunities"
            className="mz-btn min-h-12"
          >
            See live roles <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </Shell>
    );
  }

  /* ── Fallback error ── */
  if (!card && fallbackState === 'error') {
    return (
      <Shell>
        <BackLink />
        <div className="space-y-4 py-12 text-center">
          <h1 className="mz-h1">Couldn&apos;t load this role</h1>
          <p className="mz-body">
            This is a system state — not a change to the role or your match. Try again shortly.
          </p>
        </div>
      </Shell>
    );
  }

  const opportunity = card ?? fallback;
  if (!opportunity) {
    // idle with neither source resolved yet (first client render before effect)
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-16" role="status" aria-live="polite">
          <Loader2 className="h-7 w-7 animate-spin text-[var(--ink-400)]" aria-hidden />
          <p className="mz-small">Loading role…</p>
        </div>
      </Shell>
    );
  }

  const match = card?.match ?? null;
  const application = card?.application ?? null;

  return (
    <Shell>
      <BackLink />

      <header className="mz-glass p-5 sm:p-6">
        <p className="mz-eyebrow">
          <Building2 className="h-3.5 w-3.5 opacity-60" aria-hidden />
          {opportunity.organizationName}
        </p>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="mz-h1 mt-2">{opportunity.title}</h1>
          {/* CC-09: private research capture, right where the role is. */}
          <CaptureInWorkbench context={`Role: ${opportunity.title} — ${opportunity.state}`} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 mz-small">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {opportunity.state}
            {opportunity.remote ? ' · Remote-friendly' : ''}
          </span>
          <span className="opacity-40">·</span>
          <span className="inline-flex items-center gap-1">
            <Stethoscope className="h-3.5 w-3.5" aria-hidden />
            {opportunity.specialty}
          </span>
          {opportunity.payRange ? (
            <>
              <span className="opacity-40">·</span>
              <span className="inline-flex items-center gap-1 font-medium text-[var(--ink-800)]">
                <Banknote className="h-3.5 w-3.5 opacity-70" aria-hidden />
                {opportunity.payRange}
              </span>
            </>
          ) : null}
          {opportunity.hiringType ? (
            <>
              <span className="opacity-40">·</span>
              <span>{opportunity.hiringType}</span>
            </>
          ) : null}
        </div>

        {/* Primary action */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {application ? (
            <Link
              href={`/holder/applications/${encodeURIComponent(application.id)}`}
              className="mz-btn mz-btn-ghost min-h-12"
            >
              You applied — view your application <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <Link
              href={`/holder/opportunities?apply=${encodeURIComponent(opportunity.id)}`}
              className="mz-btn min-h-12"
            >
              Apply with your VitalCV <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>
      </header>

      {/* Match explanation — only when this role is in the live matched feed */}
      {match ? (
        <section
          aria-labelledby="match-heading"
          className="mz-glass p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="match-heading" className="mz-eyebrow">
              Your match
            </h2>
            {/* Band word only — never a magic number (A4 gate: a clinician
                compares roles by explained fit, not a score). */}
            <span className={matchBandTone(match.band)}>
              <span className="mz-gl" />
              {matchBandLabel(match.band)}
            </span>
          </div>
          {match.fitReasons.length > 0 && (
            <div className="mt-3">
              <p className="mz-mono text-[11px] uppercase tracking-[0.18em] opacity-60">Why you fit</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {match.fitReasons.map((reason) => (
                  <li
                    key={reason}
                    className="mz-inset px-2.5 py-1 text-xs text-[var(--ink-700)]"
                  >
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {match.blockers.length > 0 && (
            <div className="mt-4">
              <p className="mz-mono text-[11px] uppercase tracking-[0.18em] text-[var(--watch)]">
                What would strengthen this match
              </p>
              <ul className="mt-2 space-y-2">
                {match.blockers.map((blocker) => (
                  <li
                    key={blocker.label}
                    className="mz-inset px-4 py-2.5 mz-body"
                  >
                    {blocker.label}
                    {blocker.action ? <span className="text-[var(--ink-500)]"> — {blocker.action}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-4 mz-small leading-relaxed">
            Match scoring is deterministic and based on your recorded credentials and stated
            preferences. It is guidance, not a verification result and not an employer decision.
          </p>
        </section>
      ) : (
        <section className="mz-card mz-card-pad">
          <p className="mz-body">
            This role is not in your matched feed right now, so no match explanation is available.
            Your feed reflects your recorded credentials and preferences.
          </p>
        </section>
      )}

      {/* Role description */}
      <section aria-labelledby="role-heading" className="mz-card mz-card-pad">
        <h2 id="role-heading" className="mz-eyebrow">
          About this role
        </h2>
        {opportunity.description ? (
          <p className="mt-3 whitespace-pre-line mz-body">{opportunity.description}</p>
        ) : (
          <p className="mt-3 mz-small">
            The employer has not published a description for this role yet.
          </p>
        )}
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mz mz-paper mz-ambient min-h-screen w-full">
      <PageFrame mode="product" className="vcv-page-frame--mobile-nav max-w-3xl flex flex-col gap-5">
        {children}
      </PageFrame>
    </main>
  );
}

function BackLink() {
  return (
    <Link
      href="/holder/opportunities"
      className="inline-flex w-fit items-center gap-1.5 mz-small transition hover:text-[var(--ink-900)]"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden /> All roles
    </Link>
  );
}
