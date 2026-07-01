'use client';

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
      return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100';
    case 'NEAR_CLEAR':
      return 'border-sky-400/30 bg-sky-400/10 text-sky-100';
    case 'PARTIAL':
      return 'border-amber-400/30 bg-amber-400/10 text-amber-100';
    default:
      return 'border-white/15 bg-white/[0.05] text-white/70';
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
          <Loader2 className="h-7 w-7 animate-spin text-white/40" aria-hidden />
          <p className="text-sm text-white/50">Loading role…</p>
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
          <h1 className="text-2xl font-semibold text-white">This role is no longer available</h1>
          <p className="text-sm leading-6 text-white/60">
            It may have been filled or withdrawn by the employer. Your matched feed always shows
            what is live right now.
          </p>
          <Link
            href="/holder/opportunities"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400"
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
          <h1 className="text-xl font-semibold text-white">Couldn&apos;t load this role</h1>
          <p className="text-sm leading-6 text-white/60">
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
          <Loader2 className="h-7 w-7 animate-spin text-white/40" aria-hidden />
          <p className="text-sm text-white/50">Loading role…</p>
        </div>
      </Shell>
    );
  }

  const match = card?.match ?? null;
  const application = card?.application ?? null;

  return (
    <Shell>
      <BackLink />

      <header className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-white/50">
          <Building2 className="h-3.5 w-3.5 opacity-60" aria-hidden />
          {opportunity.organizationName}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{opportunity.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/65">
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
              <span className="inline-flex items-center gap-1 font-medium text-emerald-100/90">
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
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-6 py-3 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300/50"
            >
              You applied — view your application <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <Link
              href={`/holder/opportunities?apply=${encodeURIComponent(opportunity.id)}`}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400"
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
          className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="match-heading" className="text-[11px] uppercase tracking-[0.18em] text-white/45">
              Your match
            </h2>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${matchBandTone(match.band)}`}>
              {matchBandLabel(match.band)} · {match.score}/100
            </span>
          </div>
          {match.fitReasons.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Why you fit</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {match.fitReasons.map((reason) => (
                  <li
                    key={reason}
                    className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-white/80"
                  >
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {match.blockers.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-200/70">
                What would strengthen this match
              </p>
              <ul className="mt-2 space-y-2">
                {match.blockers.map((blocker) => (
                  <li
                    key={blocker.label}
                    className="rounded-2xl border border-amber-400/15 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-50"
                  >
                    {blocker.label}
                    {blocker.action ? <span className="text-amber-100/70"> — {blocker.action}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-4 text-xs leading-relaxed text-white/40">
            Match scoring is deterministic and based on your recorded credentials and stated
            preferences. It is guidance, not a verification result and not an employer decision.
          </p>
        </section>
      ) : (
        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm leading-6 text-white/60">
            This role is not in your matched feed right now, so no match explanation is available.
            Your feed reflects your recorded credentials and preferences.
          </p>
        </section>
      )}

      {/* Role description */}
      <section aria-labelledby="role-heading" className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
        <h2 id="role-heading" className="text-[11px] uppercase tracking-[0.18em] text-white/45">
          About this role
        </h2>
        {opportunity.description ? (
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-white/70">{opportunity.description}</p>
        ) : (
          <p className="mt-3 text-sm leading-6 text-white/50">
            The employer has not published a description for this role yet.
          </p>
        )}
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pb-28 pt-6 sm:px-6 sm:pb-12">
      {children}
    </main>
  );
}

function BackLink() {
  return (
    <Link
      href="/holder/opportunities"
      className="inline-flex w-fit items-center gap-1.5 text-sm text-white/55 transition hover:text-white"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden /> All roles
    </Link>
  );
}
