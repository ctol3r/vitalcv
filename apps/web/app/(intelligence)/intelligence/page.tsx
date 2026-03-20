import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { CalibrationDashboard } from '@/app/calibration/CalibrationDashboard';
import { ActionsSurface } from '@/components/intelligence-ops/actions-surface';
import { DashboardSurface } from '@/components/intelligence-ops/dashboard-surface';
import { FindingsSurface } from '@/components/intelligence-ops/findings-surface';
import { GraphSurface } from '@/components/intelligence-ops/graph-surface';
import { InvestigationsSurface } from '@/components/intelligence-ops/investigations-surface';
import { ProvidersSurface } from '@/components/intelligence-ops/providers-surface';
import { StorylinesSurface } from '@/components/intelligence-ops/storylines-surface';
import { SystemHealthSurface } from '@/components/intelligence-ops/system-health-surface';
import {
  normalizeIntelligenceHref,
  resolveIntelligenceView,
  type IntelligenceView,
} from '@/lib/intelligence/routes';

export const metadata = {
  title: 'Operator Workbench | VitalCV',
  description: 'Live trust intelligence across findings, providers, graph, storylines, and investigations.',
};

function renderSurface(view: IntelligenceView) {
  switch (view) {
    case 'dashboard':
      return <DashboardSurface />;
    case 'findings':
      return <FindingsSurface />;
    case 'storylines':
      return <StorylinesSurface />;
    case 'providers':
      return <ProvidersSurface />;
    case 'actions':
      return <ActionsSurface />;
    case 'graph':
      return <GraphSurface />;
    case 'investigations':
      return <InvestigationsSurface />;
    case 'calibration':
      return <CalibrationDashboard />;
    case 'system-health':
      return <SystemHealthSurface />;
    default:
      return <DashboardSurface />;
  }
}

function toSearchParams(searchParams: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item.trim().length > 0) {
          params.append(key, item.trim());
        }
      }
      continue;
    }

    if (value.trim().length > 0) {
      params.set(key, value.trim());
    }
  }

  return params;
}

export default async function IntelligencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const currentParams = toSearchParams(resolvedSearchParams);
  const currentHref = `/intelligence${currentParams.toString() ? `?${currentParams.toString()}` : ''}`;
  const canonicalHref = normalizeIntelligenceHref(currentHref);

  if (canonicalHref !== currentHref) {
    redirect(canonicalHref);
  }

  const view = resolveIntelligenceView(currentParams.get('view'));

  return (
    <Suspense fallback={null}>
      {renderSurface(view)}
    </Suspense>
  );
}
