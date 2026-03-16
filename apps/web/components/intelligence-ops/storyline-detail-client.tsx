'use client';

import Link from 'next/link';
import { useStoryline } from '@/hooks/useIntelligenceDetail';
import type { StorylineDetailResponse } from '@/lib/intelligence/detail-types';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { StorylineMutationControls } from './mutation-controls';
import { BackLink, EntityLink, OpsBadge, OpsCard, SurfaceBanner, SurfaceErrorState, TimestampPair, severityTone } from './primitives';
import { OperationsShell } from './shell';
import { VerticalTimeline } from './vertical-timeline';

function titleCase(value: string): string {
  return value.replace(/_/g, ' ');
}

function severityRank(value: string): number {
  switch (value.toLowerCase()) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

export function StorylineDetailClient({
  storylineId,
  initialData,
  backHref,
}: {
  storylineId: string;
  initialData: StorylineDetailResponse;
  backHref: string;
}) {
  const resource = useStoryline(storylineId, { initialData });
  const detail = resource.data ?? initialData;
  const providerLinks = detail.entityLinks.filter((entity) => (
    entity.entityType === 'provider' && /^\d{10}$/.test(entity.entityKey)
  ));
  const maxFindingSeverity = detail.findingLinks.reduce((current, link) => (
    severityRank(link.findingSeverity) > severityRank(current) ? link.findingSeverity : current
  ), detail.storyline.severity);

  return (
    <OperationsShell
      activeHref="/storylines"
      title={detail.storyline.title}
      description={detail.storyline.summary}
      breadcrumbs={[
        { label: 'Storylines', href: backHref },
        { label: 'Detail' },
      ]}
      meta={(
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Storyline detail</p>
          <p title={formatAbsoluteTime(detail.storyline.lastActivityAt)}>
            Active {formatRelativeTime(detail.storyline.lastActivityAt)}
          </p>
          <p>{detail.findingLinks.length} linked findings</p>
        </div>
      )}
      actions={<BackLink href={backHref} label="Back to storylines" />}
      banner={resource.recovering && resource.error ? (
        <SurfaceBanner tone="warning">
          Refresh failed. Showing the last confirmed storyline detail snapshot.
        </SurfaceBanner>
      ) : null}
    >
      {resource.error && !resource.data ? (
        <SurfaceErrorState
          title="Storyline detail unavailable"
          description={resource.error}
          onRetry={resource.refresh}
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="space-y-4">
          <OpsCard className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <OpsBadge label={detail.storyline.severity} tone={severityTone(detail.storyline.severity)} />
              <OpsBadge label={detail.storyline.status} tone={severityTone(detail.storyline.status)} />
              <OpsBadge label={detail.storyline.storylineType} />
              <span className="text-sm text-slate-400">{detail.storyline.perspective}</span>
            </div>
            <p className="text-sm leading-7 text-slate-300">{detail.storyline.whyItMatters}</p>
            <div className="flex flex-wrap gap-2">
              {providerLinks.map((entity) => (
                <EntityLink
                  key={`${entity.entityType}-${entity.entityKey}`}
                  href={`/providers/${entity.entityKey}?from=/storylines/${storylineId}`}
                  label={entity.entityLabel ?? entity.entityKey}
                />
              ))}
            </div>
          </OpsCard>

          <OpsCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Timeline</h2>
              <span className="text-sm text-slate-400">{detail.storyline.timeline.events.length} events</span>
            </div>
            <VerticalTimeline
              items={detail.storyline.timeline.events.map((event) => ({
                id: event.eventKey,
                occurredAt: event.occurredAt,
                label: titleCase(event.type),
                description: event.summary,
                meta: [
                  event.toStatus ? `Status ${event.toStatus}` : null,
                  event.findingIds.length > 0 ? `${event.findingIds.length} linked finding${event.findingIds.length === 1 ? '' : 's'}` : null,
                ].filter(Boolean).join(' · ') || undefined,
              }))}
              emptyMessage="No timeline events have been recorded for this storyline."
            />
          </OpsCard>

          <OpsCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Evidence</h2>
              <span className="text-sm text-slate-400">{detail.storyline.supportingEvidence.length} items</span>
            </div>
            {detail.storyline.supportingEvidence.length > 0 ? (
              <div className="space-y-3">
                {detail.storyline.supportingEvidence.map((evidence) => (
                  <div key={`${evidence.source}-${evidence.observedAt}-${evidence.bullet}`} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <OpsBadge label={evidence.source} />
                      <span className="text-sm text-slate-400">Confidence {Math.round(evidence.confidence * 100)}%</span>
                      <TimestampPair label="Observed" value={evidence.observedAt} />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{evidence.bullet}</p>
                    {evidence.findingId ? (
                      <div className="mt-3">
                        <EntityLink href={`/findings/${evidence.findingId}?from=/storylines/${storylineId}`} label={`Finding ${evidence.findingId}`} />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No supporting evidence has been attached to this storyline.</p>
            )}
          </OpsCard>

          <OpsCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Linked findings</h2>
              <span className="text-sm text-slate-400">{detail.findingLinks.length} findings</span>
            </div>
            {detail.findingLinks.length > 0 ? (
              <div className="space-y-3">
                {detail.findingLinks.map((link) => (
                  <div key={link.findingId} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <OpsBadge label={link.findingSeverity} tone={severityTone(link.findingSeverity)} />
                      <OpsBadge label={link.findingCategory.replace(/_/g, ' ')} />
                      <span className="text-sm text-slate-400">Weight {Math.round(link.weight * 100)}%</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Link href={`/findings/${link.findingId}?from=/storylines/${storylineId}`} className="text-sm font-medium text-cyan-200 transition hover:text-cyan-100">
                        Open finding {link.findingId}
                      </Link>
                      {providerLinks[0] ? (
                        <Link
                          href={`/providers/${providerLinks[0].entityKey}?from=/storylines/${storylineId}`}
                          className="text-sm font-medium text-slate-300 transition hover:text-white"
                        >
                          Open provider
                        </Link>
                      ) : null}
                      <span className="text-sm text-slate-400" title={formatAbsoluteTime(link.observedAt)}>
                        {formatRelativeTime(link.observedAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No finding links were recorded for this storyline.</p>
            )}
          </OpsCard>
        </div>

        <div className="space-y-4">
          <OpsCard className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Triage</h2>
            <StorylineMutationControls storylineId={detail.storyline.storylineId} status={detail.storyline.status} />
          </OpsCard>

          <OpsCard className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Provider reference</h2>
            <p className="text-sm text-slate-300">Finding count {detail.findingLinks.length}</p>
            <p className="text-sm text-slate-300">Max severity {maxFindingSeverity}</p>
            <TimestampPair label="Created" value={detail.storyline.createdAt} />
            <TimestampPair label="Updated" value={detail.storyline.updatedAt} />
            {providerLinks.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {providerLinks.map((entity) => (
                  <EntityLink
                    key={`${entity.entityType}-${entity.entityKey}`}
                    href={`/providers/${entity.entityKey}?from=/storylines/${storylineId}`}
                    label={entity.entityLabel ?? entity.entityKey}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No provider reference was attached to this storyline.</p>
            )}
          </OpsCard>

          <OpsCard className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Narrative metrics</h2>
            <p className="text-sm text-slate-300">Progression {Math.round(detail.storyline.progressionScore * 100)}%</p>
            <p className="text-sm text-slate-300">Novelty {Math.round(detail.storyline.noveltyScore * 100)}%</p>
            <p className="text-sm text-slate-300">Persistence {Math.round(detail.storyline.persistenceScore * 100)}%</p>
            <p className="text-sm text-slate-300">Confidence {Math.round(detail.storyline.confidence * 100)}%</p>
          </OpsCard>

          <OpsCard className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Action events</h2>
            <VerticalTimeline
              items={detail.actionEvents.map((event) => ({
                id: event.eventKey,
                occurredAt: event.occurredAt,
                label: titleCase(event.actionType),
                description: event.note ?? `${titleCase(event.actionType)} recorded for this storyline.`,
                meta: event.actorId ?? undefined,
              }))}
              emptyMessage="No action events have been recorded for this storyline yet."
            />
          </OpsCard>
        </div>
      </div>
    </OperationsShell>
  );
}
