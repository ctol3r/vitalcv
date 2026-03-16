'use client';

import type {
  IntelligenceAction,
  IntelligenceFinding,
  IntelligenceProvider,
  IntelligenceStoryline,
} from '@/lib/intelligence/contracts';
import { ActionCard } from './ActionCard';
import { FindingCard } from './FindingCard';
import { StorylineCard } from './StorylineCard';
import { SectionFrame, SurfaceState } from './shared';

interface InvestigationPanelProps {
  provider: IntelligenceProvider | null;
  findings: IntelligenceFinding[];
  storylines: IntelligenceStoryline[];
  actions: IntelligenceAction[];
  loading?: boolean;
  error?: string | null;
  onFocusProvider: (providerNpi: string) => void;
  onRetry?: () => void;
}

export function InvestigationPanel({
  provider,
  findings,
  storylines,
  actions,
  loading,
  error,
  onFocusProvider,
  onRetry,
}: InvestigationPanelProps) {
  const empty = findings.length === 0 && storylines.length === 0 && actions.length === 0;

  return (
    <SectionFrame
      eyebrow="Investigation"
      title="Live Investigation"
      detail={provider
        ? `Operational evidence for ${provider.name}. Findings, storylines, and actions stay aligned to the same provider scope.`
        : 'Select a provider to open an investigation workspace.'}
    >
      <SurfaceState
        loading={loading}
        error={error}
        empty={empty}
        emptyTitle="No active investigation items"
        emptyCopy="This provider does not currently have findings, storyline pressure, or recommended actions."
        onRetry={onRetry}
      >
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="grid gap-4">
            {findings.slice(0, 3).map((finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                onFocusProvider={onFocusProvider}
              />
            ))}
          </div>
          <div className="grid gap-4">
            {storylines.slice(0, 3).map((storyline) => (
              <StorylineCard
                key={storyline.id}
                storyline={storyline}
                onFocusProvider={onFocusProvider}
              />
            ))}
          </div>
          <div className="grid gap-4">
            {actions.slice(0, 3).map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                onFocusProvider={onFocusProvider}
              />
            ))}
          </div>
        </div>
      </SurfaceState>
    </SectionFrame>
  );
}
