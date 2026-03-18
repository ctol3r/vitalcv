'use client';

import { useMemo } from 'react';
import { useFinding } from '@/hooks/useIntelligenceDetail';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import type { InvestigatorFindingDetailResponse } from '@/lib/intelligence/detail-types';
import { buildFindingEvidenceRows, summarizeFindingEvidenceRows } from '@/lib/intelligence/evidence';
import { buildIntelligenceGraphHref, buildIntelligenceHref } from '@/lib/intelligence/routes';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { OperationsShell } from './shell';
import { BackLink, ConfidenceMeter, EntityLink, OpsBadge, OpsCard, SurfaceBanner, SurfaceErrorState, TimestampPair, severityTone } from './primitives';
import { FindingMutationControls } from './mutation-controls';
import { TrustSignalChips } from './trust-signal-chips';
import { EvidenceViewer } from '@/components/intelligence/evidence-viewer';
import { StorylineMini } from '@/components/intelligence/storyline-mini';

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
  const evidenceRows = useMemo(
    () => buildFindingEvidenceRows(finding.supportingEvidence, finding.confidence, systemHealth.data),
    [finding.confidence, finding.supportingEvidence, systemHealth.data],
  );
  const trustSummary = useMemo(
    () => summarizeFindingEvidenceRows(evidenceRows, finding.confidence),
    [evidenceRows, finding.confidence],
  );
  const storylineId = finding.storylineId || relatedStoryline?.storylineId || null;
  const storylineTitle = finding.storylineTitle || relatedStoryline?.title || 'Related storyline';
  const storylineSeverity = relatedStoryline?.severity || finding.severity;
  const storylineTimeline = useMemo(() => {
    if (finding.statusEvents.length > 0) {
      return finding.statusEvents.map((event, index) => ({
        id: `${finding.findingId}-status-${index}`,
        occurredAt: event.createdAt,
        label: event.toStatus,
        description: event.fromStatus ? `Status updated from ${event.fromStatus} to ${event.toStatus}.` : `Status set to ${event.toStatus}.`,
        meta: event.actorId ?? undefined,
      }));
    }

    return [
      {
        id: `${finding.findingId}-created`,
        occurredAt: finding.createdAt,
        description: 'Finding record created.',
      },
    ];
  }, [finding.createdAt, finding.findingId, finding.statusEvents]);

  return (
    <OperationsShell
      activeHref="/findings"
      activeNavKey="findings"
      title={finding.title}
      description={finding.summary}
      breadcrumbs={[
        { label: 'Findings', href: backHref },
        { label: 'Detail' },
      ]}
      meta={(
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Finding detail</p>
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
              <OpsBadge label={`${Math.round(finding.confidence * 100)}% confidence`} tone={trustSummary.confidenceBand === 'HIGH' ? 'success' : trustSummary.confidenceBand === 'MEDIUM' ? 'info' : 'warning'} />
              <span className="text-sm text-[var(--vt-text-3)]">{finding.investigatorId}</span>
            </div>
            <div className="space-y-3">
              <p className="text-sm leading-7 text-[var(--vt-text-2)]">{finding.explanation}</p>
              <TrustSignalChips summary={trustSummary} />
              <div className="flex flex-wrap gap-2">
                {providerNpi ? (
                  <>
                    <EntityLink href={`/providers/${providerNpi}?from=/findings/${findingId}`} label={providerLabel ?? `Provider ${providerNpi}`} />
                    <EntityLink href={buildIntelligenceHref('investigations', { npi: providerNpi })} label="Open investigation" />
                  </>
                ) : null}
                {(providerNpi || storylineId) ? (
                  <EntityLink
                    href={buildIntelligenceGraphHref({
                      npi: providerNpi,
                      providerId: providerNpi,
                      findingId,
                      storylineId,
                    })}
                    label="Open graph"
                  />
                ) : null}
              </div>
            </div>
          </OpsCard>

          {storylineId ? (
            <StorylineMini
              title={storylineTitle}
              severity={storylineSeverity}
              findingsCount={1}
              storylineId={storylineId}
              providerNpi={providerNpi}
              from={`/findings/${findingId}`}
              timeline={storylineTimeline}
            />
          ) : null}

          <EvidenceViewer rows={evidenceRows} />

          <OpsCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Status history</h2>
              <span className="text-sm text-[var(--vt-text-3)]">{finding.statusEvents.length} events</span>
            </div>
            {finding.statusEvents.length > 0 ? (
              <div className="space-y-3">
                {finding.statusEvents.map((event) => (
                  <div key={`${event.createdAt}-${event.toStatus}`} className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <OpsBadge label={event.toStatus} tone={severityTone(event.toStatus)} />
                      {event.actorId ? <span className="text-sm text-[var(--vt-text-3)]">{event.actorId}</span> : null}
                      <span className="text-sm text-[var(--vt-text-3)]" title={formatAbsoluteTime(event.createdAt)}>
                        {formatRelativeTime(event.createdAt)}
                      </span>
                    </div>
                    {event.note ? <p className="mt-2 text-sm text-[var(--vt-text-2)]">{event.note}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--vt-text-3)]">No status events have been recorded for this finding yet.</p>
            )}
          </OpsCard>
        </div>

        <div className="space-y-4">
          <OpsCard className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Triage</h2>
            <FindingMutationControls findingId={finding.findingId} status={finding.status} />
          </OpsCard>

          <OpsCard className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Related entities</h2>
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
                      className="inline-flex items-center rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-1 text-xs text-[var(--vt-text-2)]"
                    >
                      {entity.entityLabel ?? entity.entityId}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[var(--vt-text-3)]">No related entities were persisted for this finding.</p>
            )}
          </OpsCard>

          <OpsCard className="space-y-2">
            <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Scoring & trust</h2>
            <p className="text-sm text-[var(--vt-text-2)]">Priority {Math.round(finding.priorityScore)}</p>
            <div className="flex items-center gap-2 text-sm text-[var(--vt-text-2)]">
              <span>Confidence</span>
              <ConfidenceMeter confidence={finding.confidence} />
            </div>
            <TrustSignalChips summary={trustSummary} />
            <p className="text-sm text-[var(--vt-text-2)]">
              {finding.supportingEvidence.length} evidence item{finding.supportingEvidence.length === 1 ? '' : 's'} • {trustSummary.uniqueSourceCount} source{trustSummary.uniqueSourceCount === 1 ? '' : 's'}
            </p>
            <p className="text-sm text-[var(--vt-text-2)]">Audience {finding.audienceRoles.join(', ') || 'None'}</p>
          </OpsCard>

          <OpsCard className="space-y-2">
            <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Timestamps</h2>
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
