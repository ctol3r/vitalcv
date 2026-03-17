'use client';

import type { ReactNode } from 'react';
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

function FeedColumn({
  eyebrow,
  title,
  detail,
  children,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <section className="vital-feed-column">
      <div className="vital-feed-column__header">
        <div>
          <p className="vital-feed-column__eyebrow">{eyebrow}</p>
          <h3 className="vital-feed-column__title">{title}</h3>
        </div>
        <p className="vital-feed-column__detail">{detail}</p>
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
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
          <FeedColumn
            eyebrow="Critical First"
            title="Findings Queue"
            detail="Severity and investigator ownership stay visible at a glance."
          >
            {findings.slice(0, 3).map((finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                onFocusProvider={onFocusProvider}
              />
            ))}
          </FeedColumn>

          <FeedColumn
            eyebrow="Latest Activity"
            title="Storyline Pressure"
            detail="Recent storyline movement stays distinct from static historical noise."
          >
            {storylines.slice(0, 3).map((storyline) => (
              <StorylineCard
                key={storyline.id}
                storyline={storyline}
                onFocusProvider={onFocusProvider}
              />
            ))}
          </FeedColumn>

          <FeedColumn
            eyebrow="Priority Queue"
            title="Recommended Actions"
            detail="Action cards stay compact so operators can scan and execute without hunting."
          >
            {actions.slice(0, 3).map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                onFocusProvider={onFocusProvider}
              />
            ))}
          </FeedColumn>
        </div>
      </SurfaceState>
    </SectionFrame>
  );
}
