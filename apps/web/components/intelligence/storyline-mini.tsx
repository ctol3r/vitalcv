'use client';

import Link from 'next/link';
import type { VerticalTimelineItem } from '@/components/intelligence-ops/vertical-timeline';
import { VerticalTimeline } from '@/components/intelligence-ops/vertical-timeline';
import { OpsBadge, OpsCard, severityTone } from '@/components/intelligence-ops/primitives';

interface StorylineMiniProps {
  title: string;
  severity: string;
  findingsCount: number;
  storylineId?: string | null;
  providerNpi?: string | null;
  from?: string;
  timeline?: VerticalTimelineItem[];
}

const UNKNOWN_TEXT = 'Provider details not available';

export function StorylineMini({
  title,
  severity,
  findingsCount,
  storylineId,
  providerNpi,
  from,
  timeline,
}: StorylineMiniProps) {
  const tone = severityTone(severity);
  const normalizedCount = Math.max(0, findingsCount);
  const fromQuery = from ? `?from=${encodeURIComponent(from)}` : '';
  const baseFrom = from ?? '/findings';
  const storylineHref = storylineId ? `/storylines/${storylineId}${fromQuery}` : null;
  const providerHref = providerNpi ? `/providers/${providerNpi}?from=${encodeURIComponent(baseFrom)}` : null;

  return (
    <OpsCard className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Storyline</h2>
          <OpsBadge label={severity} tone={tone} />
        </div>
        <p className="text-sm text-[var(--vt-text-2)]">{title}</p>
        <p className="text-xs text-[var(--vt-text-3)]">
          {normalizedCount} linked finding{normalizedCount === 1 ? '' : 's'}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Navigation</p>
        <div className="flex flex-wrap gap-2">
          {storylineHref ? (
            <Link
              href={storylineHref}
              className="text-sm font-medium text-[var(--vt-accent)] transition hover:opacity-80"
            >
              Open storyline
            </Link>
          ) : null}
          {providerHref ? (
            <Link
              href={providerHref}
              className="text-sm text-[var(--vt-text-2)] transition hover:text-[var(--vt-text-1)]"
            >
              Open provider
            </Link>
          ) : (
            <p className="text-sm text-[var(--vt-text-3)]">{UNKNOWN_TEXT}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Recent storyline events</p>
        <VerticalTimeline items={timeline ?? []} emptyMessage="No timeline events are attached yet." />
      </div>
    </OpsCard>
  );
}
