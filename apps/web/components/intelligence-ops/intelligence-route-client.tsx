'use client';

import { CalibrationDashboard } from '@/app/calibration/CalibrationDashboard';
import { VBanner } from '@/components/vds/primitives';
import { DEFAULT_INTELLIGENCE_VIEW, type IntelligenceView } from '@/lib/intelligence/routes';
import { isPilotIntelligenceViewEnabled } from '@/lib/pilot-flags';
import { useWorkspace } from '@/lib/intelligence/workspace-store';
import { ActionsSurface } from './actions-surface';
import { DashboardSurface } from './dashboard-surface';
import { FindingsSurface } from './findings-surface';
import { GraphSurface } from './graph-surface';
import { InvestigationsSurface } from './investigations-surface';
import { ProvidersSurface } from './providers-surface';
import { StorylinesSurface } from './storylines-surface';
import { SystemHealthSurface } from './system-health-surface';

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

export function IntelligenceRouteClient({
  view,
}: {
  view: IntelligenceView;
}) {
  useWorkspace();

  const resolvedView = isPilotIntelligenceViewEnabled(view) ? view : DEFAULT_INTELLIGENCE_VIEW;

  return (
    <>
      {resolvedView !== view ? (
        <div className="border-b border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-4 py-3">
          <VBanner tone="warning">
            Pilot safe mode is active. That surface is currently hidden for pilot stability, so VitalCV returned you to the primary monitor view.
          </VBanner>
        </div>
      ) : null}
      {renderSurface(resolvedView)}
    </>
  );
}
