'use client';

import { Compass, RefreshCw } from 'lucide-react';
import { OpportunityGrid, SelectedOpportunityBanner } from '@/components/mobile/ClinicianPanels';
import { ClinicianStatusBanner } from '@/components/mobile/ClinicianStatusBanner';
import { ClinicianSupportCard } from '@/components/mobile/ClinicianSupportCard';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';

export default function ClinicianOpportunitiesSurface() {
  const {
    data,
    isRefreshing,
    refreshError,
    refresh,
  } = useClinicianMobile();

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

      <OpportunityGrid
        opportunities={data.opportunities}
        heading="Live opportunity feed"
        description="Choose a role, understand the fit, and move into apply without losing context."
      />

      <ClinicianSupportCard
        topic="opportunities"
        detail="If the role feed is empty or a live role looks mismatched, return home to review readiness first, then contact support if the same role stays out of sync."
        primaryHref="/holder/home"
        primaryLabel="Review home state"
      />
    </main>
  );
}
