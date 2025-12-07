'use client';

import { Badge } from '@/components/ui/badge';
import type { GovernanceTimelineEvent } from '@/lib/governance/types';
import { cn } from '@/lib/utils';
import { CheckCircle2, GitCommit, Gavel, Vote } from 'lucide-react';

interface GovernanceTimelineProps {
  events: GovernanceTimelineEvent[];
}

export default function GovernanceTimeline({ events }: GovernanceTimelineProps) {
  if (!events.length) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No activity yet. Recent events will appear here once proposals are created.
      </div>
    );
  }

  const ordered = [...events].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );

  return (
    <div className="space-y-4">
      {ordered.map((event, index) => (
        <div key={event.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <EventIcon type={event.type} />
            {index < ordered.length - 1 && <div className="h-full w-px bg-border" />}
          </div>
          <div className="flex-1 rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{event.label}</p>
              <Badge variant="outline">{event.type}</Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(event.at).toLocaleString()}
              </span>
            </div>
            {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
            {event.metadata && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {Object.entries(event.metadata).map(([key, value]) => (
                  <span key={`${event.id}-${key}`} className="rounded bg-muted px-2 py-0.5">
                    {key}: {String(value)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function EventIcon({ type }: { type: GovernanceTimelineEvent['type'] }) {
  const baseClass = 'flex h-10 w-10 items-center justify-center rounded-full border';
  switch (type) {
    case 'proposalCreated':
      return (
        <div className={cn(baseClass, 'bg-primary/10 text-primary')}>
          <Gavel className="h-4 w-4" aria-hidden="true" />
        </div>
      );
    case 'voteCast':
      return (
        <div className={cn(baseClass, 'bg-muted')}>
          <Vote className="h-4 w-4" aria-hidden="true" />
        </div>
      );
    case 'proposalExecuted':
      return (
        <div className={cn(baseClass, 'bg-emerald-100 text-emerald-700')}>
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        </div>
      );
    case 'statusChanged':
    default:
      return (
        <div className={cn(baseClass, 'bg-secondary/50 text-secondary-foreground')}>
          <GitCommit className="h-4 w-4" aria-hidden="true" />
        </div>
      );
  }
}










