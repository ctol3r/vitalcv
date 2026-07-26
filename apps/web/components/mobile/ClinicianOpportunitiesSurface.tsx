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
    <main className="mz mz-paper mz-ambient min-h-screen w-full">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pb-28 pt-6 sm:px-6 sm:pb-12 lg:px-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="mz-eyebrow">
              <Compass className="h-3.5 w-3.5" />
              Matched opportunities
            </div>
            <h1 className="mz-h1 mt-4">View opportunities</h1>
            <p className="mt-2 max-w-2xl mz-body">
              Pick a role, apply when you are ready, and keep every update in one place.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isRefreshing}
            className="mz-btn mz-btn-ghost min-h-12 disabled:cursor-not-allowed disabled:opacity-60"
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
      </div>
    </main>
  );
}
