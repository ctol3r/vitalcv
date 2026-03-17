import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { ActionsSurface } from '@/components/intelligence-ops/actions-surface';
import { FindingsSurface } from '@/components/intelligence-ops/findings-surface';
import { IntelligenceOverviewSurface } from '@/components/intelligence-ops/intelligence-overview-surface';
import { InvestigationsSurface } from '@/components/intelligence-ops/investigations-surface';
import { ProvidersSurface } from '@/components/intelligence-ops/providers-surface';
import { StorylinesSurface } from '@/components/intelligence-ops/storylines-surface';
import { SystemHealthSurface } from '@/components/intelligence-ops/system-health-surface';
import { CalibrationDashboard } from '@/app/calibration/CalibrationDashboard';
import {
  buildLegacyRedirectHref,
  resolveIntelligenceView,
} from '@/lib/intelligence/routes';

export const metadata = {
  title: 'Operator Workbench | VitalCV',
  description: 'Canonical operator surface for dashboard, findings, storylines, providers, actions, investigations, calibration, and system health.',
};

function renderSurface(view: ReturnType<typeof resolveIntelligenceView>) {
  switch (view) {
    case 'dashboard':
      return <IntelligenceOverviewSurface />;
    case 'findings':
      return <FindingsSurface />;
    case 'storylines':
      return <StorylinesSurface />;
    case 'providers':
      return <ProvidersSurface />;
    case 'actions':
      return <ActionsSurface />;
    case 'investigations':
      return <InvestigationsSurface />;
    case 'calibration':
      return <CalibrationDashboard />;
    case 'system-health':
      return <SystemHealthSurface />;
    default:
      return <IntelligenceOverviewSurface />;
  }
}

export default async function IntelligencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const rawTab = typeof resolvedSearchParams.tab === 'string' ? resolvedSearchParams.tab : null;
  const rawView = typeof resolvedSearchParams.view === 'string' ? resolvedSearchParams.view : null;
  const view = resolveIntelligenceView(rawView ?? rawTab);

  if (rawTab !== null || (rawView !== null && rawView !== view)) {
    redirect(buildLegacyRedirectHref(view, resolvedSearchParams));
  }

  return (
    <Suspense fallback={null}>
      {renderSurface(view)}
    </Suspense>
  );
}
