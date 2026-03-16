'use client';

import { useMemo } from 'react';
import { useFinding } from '@/hooks/useIntelligenceDetail';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import type { InvestigatorFindingDetailResponse } from '@/lib/intelligence/detail-types';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { OperationsShell } from './shell';
import { BackLink, BadgeLink, ConfidenceMeter, EntityLink, OpsBadge, OpsCard, SurfaceBanner, SurfaceErrorState, TimestampPair, severityTone } from './primitives';
import { FindingMutationControls } from './mutation-controls';
import { FindingEvidenceTable } from './finding-evidence-table';

export function FindingDetailClient({
  findingId,
  initialData,
  backHref,
}: {
  findingId: string;
  initialData: InvestigatorFindingDetailResponse;
  backHref: string;
}) {
  const resource = useFinding(findingId, { initialData });
  const systemHealth = useSystemHealth(60_000);

  const finding = resource.data?.finding ?? initialData.finding;
  const relatedStoryline = resource.data?.relatedStoryline ?? initialData.relatedStoryline ?? null;
  const providerNpi = useMemo(() => {
    const fromMetadata = typeof finding.metadata?.npi === 'string' ? finding.metadata.npi : null;
    if (fromMetadata) {
      return fromMetadata;
    }

    return finding.entityIds.find((entityId) => /^\d{10}$/.test(entityId)) ?? null;
  }, [finding.entityIds, finding.metadata]);
  const providerLabel = useMemo(() => {
    const providerEntity = finding.entities.find((entity) => (
      entity.entityType === 'provider'
      && (
        !providerNpi
        || entity.entityId === providerNpi
        || entity.entityId.endsWith(`:${providerNpi}`)
      )
    ));

    if (providerEntity?.entityLabel?.trim()) {
      return providerEntity.entityLabel.trim();
    }

    for (const candidate of [
      finding.metadata?.providerName,
      finding.metadata?.fullName,
      finding.metadata?.subjectName,
      finding.metadata?.name,
    ]) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    return providerNpi ? `Provider ${providerNpi}` : null;
  }, [finding.entities, finding.metadata, providerNpi]);

  return (
    <OperationsShell
      activeHref="/findings"
      title={finding.title}
      description={finding.summary}
      breadcrumbs={[
        { label: 'Findings', href: backHref },
        { label: 'Detail' },
      ]}
      meta={(
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Finding detail</p>
          <p title={formatAbsoluteTime(finding.updatedAt)}>Updated {formatRelativeTime(finding.updatedAt)}</p>
          <p>{finding.occurrenceCount} occurrence{finding.occurrenceCount === 1 ? '' : 's'}</p>
        </div>
      )}
      actions={<BackLink href={backHref} label="Back to findings" />}
      banner={resource.recovering && resource.error ? (
        <SurfaceBanner tone="warning">
          Refresh failed. Showing the last confirmed finding detail snapshot.
        </SurfaceBanner>
      ) : null}
    >
      {resource.error && !resource.data ? (
        <SurfaceErrorState
          title="Finding detail unavailable"
          description={resource.error}
          onRetry={resource.refresh}
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="space-y-4">
          <OpsCard className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <OpsBadge label={finding.severity} tone={severityTone(finding.severity)} />
              <OpsBadge label={finding.status} tone={severityTone(finding.status)} />
              <OpsBadge label={finding.findingType.replace(/_/g, ' ')} />
              <span className="text-sm text-slate-400">{finding.investigatorId}</span>
            </div>
            <div className="space-y-3">
              <p className="text-sm leading-7 text-slate-300">{finding.explanation}</p>
              <div className="flex flex-wrap gap-2">
                {providerNpi ? (
                  <>
                    <EntityLink href={`/providers/${providerNpi}?from=/findings/${findingId}`} label={providerLabel ?? `Provider ${providerNpi}`} />
                    <EntityLink href={`/investigations?npi=${providerNpi}`} label="Open investigation" />
                  </>
                ) : null}
                {finding.storylineId ? (
                  <BadgeLink
                    href={`/storylines/${finding.storylineId}?from=/findings/${findingId}`}
                    label="Storyline"
                    tone="info"
                    title={finding.storylineTitle ?? 'Open storyline'}
                  />
                ) : relatedStoryline ? (
                  <BadgeLink
                    href={`/storylines/${relatedStoryline.storylineId}?from=/findings/${findingId}`}
                    label="Storyline"
                    tone="info"
                    title={relatedStoryline.title}
                  />
                ) : null}
              </div>
            </div>
          </OpsCard>

          <FindingEvidenceTable
            evidence={finding.supportingEvidence}
            confidence={finding.confidence}
            health={systemHealth.data}
          />

          <OpsCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Status history</h2>
              <span className="text-sm text-slate-400">{finding.statusEvents.length} events</span>
            </div>
            {finding.statusEvents.length > 0 ? (
              <div className="space-y-3">
                {finding.statusEvents.map((event) => (
                  <div key={`${event.createdAt}-${event.toStatus}`} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <OpsBadge label={event.toStatus} tone={severityTone(event.toStatus)} />
                      {event.actorId ? <span className="text-sm text-slate-400">{event.actorId}</span> : null}
                      <span className="text-sm text-slate-400" title={formatAbsoluteTime(event.createdAt)}>
                        {formatRelativeTime(event.createdAt)}
                      </span>
                    </div>
                    {event.note ? <p className="mt-2 text-sm text-slate-300">{event.note}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No status events have been recorded for this finding yet.</p>
            )}
          </OpsCard>
        </div>

        <div className="space-y-4">
          <OpsCard className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Triage</h2>
            <FindingMutationControls findingId={finding.findingId} status={finding.status} />
          </OpsCard>

          <OpsCard className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Related entities</h2>
            {finding.entities.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {finding.entities.map((entity) => {
                  const providerHref = entity.entityType === 'provider' && /^\d{10}$/.test(entity.entityId)
                    ? `/providers/${entity.entityId}`
                    : null;
                  return providerHref ? (
                    <EntityLink key={`${entity.entityType}-${entity.entityId}`} href={providerHref} label={entity.entityLabel ?? entity.entityId} />
                  ) : (
                    <span
                      key={`${entity.entityType}-${entity.entityId}`}
                      className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
                    >
                      {entity.entityLabel ?? entity.entityId}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No related entities were persisted for this finding.</p>
            )}
          </OpsCard>

          <OpsCard className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Scoring</h2>
            <p className="text-sm text-slate-300">Priority {Math.round(finding.priorityScore)}</p>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <span>Confidence</span>
              <ConfidenceMeter confidence={finding.confidence} />
            </div>
            <p className="text-sm text-slate-300">Audience {finding.audienceRoles.join(', ') || 'None'}</p>
          </OpsCard>

          <OpsCard className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Timestamps</h2>
            <TimestampPair label="Created" value={finding.createdAt} />
            <TimestampPair label="Updated" value={finding.updatedAt} />
            <TimestampPair label="First seen" value={finding.firstSeenAt} />
            <TimestampPair label="Last seen" value={finding.lastSeenAt} />
          </OpsCard>
        </div>
      </div>
    </OperationsShell>
  );
}
