'use client';

import Link from 'next/link';
import { ArrowRight, Compass, RefreshCw } from 'lucide-react';
import { OpportunityGrid, SelectedOpportunityBanner } from '@/components/mobile/ClinicianPanels';
import { ClinicianStatusBanner } from '@/components/mobile/ClinicianStatusBanner';
import { ClinicianSupportCard } from '@/components/mobile/ClinicianSupportCard';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { buildMobileFreshnessState } from '@/lib/mobile/freshness';

export default function ClinicianOpportunitiesSurface() {
  const {
    data,
    isRefreshing,
    refreshError,
    refresh,
  } = useClinicianMobile();
  const freshness = buildMobileFreshnessState(data.refreshedAt);
  const activeApplication = data.activeApplications[0] ?? null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pb-28 pt-6 sm:px-6 sm:pb-12 lg:px-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100">
            <Compass className="h-3.5 w-3.5" />
            Matched opportunities
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">View opportunities</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
            Pick a role, apply when you are ready, and keep every update in one place.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isRefreshing}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {refreshError ? (
        <ClinicianStatusBanner
          tone="error"
          title="Opportunities could not refresh"
          detail={refreshError}
          actionHref="/holder/home"
          actionLabel="Return home"
        />
      ) : null}

      <SelectedOpportunityBanner />

      <section className={`rounded-[28px] border p-5 shadow-[0_18px_40px_rgba(0,0,0,0.25)] ${
        freshness.isStale
          ? 'border-amber-400/20 bg-amber-400/10'
          : freshness.isAging
            ? 'border-sky-400/20 bg-sky-400/10'
            : 'border-emerald-400/20 bg-emerald-400/10'
      }`}>
        <p className={`text-[11px] uppercase tracking-[0.18em] ${
          freshness.isStale
            ? 'text-amber-100/80'
            : freshness.isAging
              ? 'text-sky-100/80'
              : 'text-emerald-100/80'
        }`}>
          Opportunity relevance
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-white">
          {data.opportunities[0]
            ? freshness.label
            : activeApplication
              ? 'Keep current roles moving'
              : 'No new role matches available right now'}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/85">
          {data.opportunities[0]
            ? freshness.detail
            : activeApplication
              ? 'No stronger live match is available right now'
              : freshness.detail}
        </p>
        {!data.opportunities[0] && activeApplication ? (
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/holder/applications/${encodeURIComponent(activeApplication.id)}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-white/90"
            >
              View application
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/holder/applications"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08]"
            >
              Open updates
            </Link>
          </div>
        ) : null}
      </section>

      {data.opportunities.length > 0 ? (
        <OpportunityGrid
          opportunities={data.opportunities}
          heading="Live opportunity feed"
          description="Choose a role, understand the fit, and move into apply without losing context."
        />
      ) : (
        <ClinicianStatusBanner
          tone="info"
          title="No new role matches available right now"
          detail={activeApplication
            ? 'Keep your current application moving while the role feed catches up.'
            : 'No stronger live match is available right now.'}
          actionHref={activeApplication
            ? `/holder/applications/${encodeURIComponent(activeApplication.id)}`
            : '/holder/readiness'}
          actionLabel={activeApplication ? 'View application' : 'View readiness'}
        />
      )}

      <ClinicianSupportCard
        topic="opportunities"
        detail="If the role feed is empty or a live role looks mismatched, return home to review readiness first, then contact support if the same role stays out of sync."
        primaryHref="/holder/home"
        primaryLabel="Review home state"
      />
    </main>
  );
}
