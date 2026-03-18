'use client';

import { useAction } from '@/hooks/useIntelligenceDetail';
import type { ActionDetailResponse } from '@/lib/intelligence/detail-types';
import { buildIntelligenceGraphHref, buildIntelligenceHref } from '@/lib/intelligence/routes';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { OperationsShell } from './shell';
import { ActionMutationControls } from './mutation-controls';
import { BackLink, EntityLink, OpsBadge, OpsCard, SurfaceBanner, SurfaceErrorState, TimestampPair, severityTone } from './primitives';

export function ActionDetailClient({
  actionId,
  initialData,
  backHref,
}: {
  actionId: string;
  initialData: ActionDetailResponse;
  backHref: string;
}) {
  const resource = useAction(actionId, { initialData });

  const detail = resource.data ?? initialData;
  const providerNpi = /^\d{10}$/.test(detail.action.targetEntity.entityId)
    ? detail.action.targetEntity.entityId
    : null;

  return (
    <OperationsShell
      activeHref="/actions"
      activeNavKey="actions"
      title={detail.action.recommendedAction}
      description={detail.action.explanation}
      breadcrumbs={[
        { label: 'Actions', href: backHref },
        { label: 'Detail' },
      ]}
      meta={(
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--vt-text-3)]">Action detail</p>
          <p title={formatAbsoluteTime(detail.action.updatedAt)}>Updated {formatRelativeTime(detail.action.updatedAt)}</p>
          <p>{detail.action.sourceFindingIds.length} source findings</p>
        </div>
      )}
      actions={<BackLink href={backHref} label="Back to actions" />}
      banner={resource.recovering && resource.error ? (
        <SurfaceBanner tone="warning">
          Refresh failed. Showing the last confirmed action detail snapshot.
        </SurfaceBanner>
      ) : null}
    >
      {resource.error && !resource.data ? (
        <SurfaceErrorState
          title="Action detail unavailable"
          description={resource.error}
          onRetry={resource.refresh}
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="space-y-4">
          <OpsCard className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <OpsBadge label={detail.action.priority} tone={severityTone(detail.action.priority)} />
              <OpsBadge label={detail.action.status} tone={severityTone(detail.action.status)} />
              <OpsBadge label={detail.action.actionType.replace(/_/g, ' ')} />
            </div>
            <div className="flex flex-wrap gap-2">
              {providerNpi ? (
                <>
                  <EntityLink
                    href={`/providers/${providerNpi}?from=/actions/${actionId}`}
                    label={detail.action.targetEntity.entityLabel ?? `Provider ${providerNpi}`}
                  />
                  <EntityLink href={buildIntelligenceHref('investigations', { npi: providerNpi })} label="Open investigation" />
                </>
              ) : null}
              {detail.action.targetEntity.entityLabel && !providerNpi ? (
                <span className="inline-flex items-center rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-1 text-xs text-[var(--vt-text-2)]">
                  {detail.action.targetEntity.entityLabel}
                </span>
              ) : null}
              {detail.action.sourceFindingIds[0] ? (
                <EntityLink
                  href={`/findings/${detail.action.sourceFindingIds[0]}?from=/actions/${actionId}`}
                  label={`Finding ${detail.action.sourceFindingIds[0]}`}
                />
              ) : null}
              {(providerNpi || detail.action.sourceFindingIds[0]) ? (
                <EntityLink
                  href={buildIntelligenceGraphHref({
                    npi: providerNpi,
                    providerId: providerNpi,
                    findingId: detail.action.sourceFindingIds[0],
                  })}
                  label="Open graph"
                />
              ) : null}
            </div>
            <p className="text-sm leading-7 text-[var(--vt-text-2)]">{detail.action.explanation}</p>
          </OpsCard>

          <OpsCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Evidence</h2>
              <span className="text-sm text-[var(--vt-text-3)]">{detail.action.evidence.length} items</span>
            </div>
            {detail.action.evidence.length > 0 ? (
              <div className="space-y-3">
                {detail.action.evidence.map((evidence, index) => (
                  <div key={`${evidence.label}-${index}`} className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <OpsBadge label={evidence.label} />
                      {evidence.source ? <span className="text-sm text-[var(--vt-text-3)]">{evidence.source}</span> : null}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--vt-text-2)]">{evidence.snippet ?? 'No evidence snippet recorded.'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--vt-text-3)]">No evidence has been attached to this action.</p>
            )}
          </OpsCard>

          <OpsCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Related findings</h2>
              <span className="text-sm text-[var(--vt-text-3)]">{detail.action.sourceFindingIds.length} linked findings</span>
            </div>
            {detail.action.sourceFindingIds.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {detail.action.sourceFindingIds.map((findingId) => (
                  <EntityLink key={findingId} href={`/findings/${findingId}?from=/actions/${actionId}`} label={`Finding ${findingId}`} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--vt-text-3)]">This action is not linked to any finding records.</p>
            )}
          </OpsCard>
        </div>

        <div className="space-y-4">
          <OpsCard className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Triage</h2>
            <ActionMutationControls actionId={detail.action.actionId} status={detail.action.status} />
          </OpsCard>

          <OpsCard className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Queue metrics</h2>
            <p className="text-sm text-[var(--vt-text-2)]">Priority score {Math.round(detail.action.priorityScore)}</p>
            <p className="text-sm text-[var(--vt-text-2)]">Confidence {Math.round(detail.action.confidence * 100)}%</p>
            <TimestampPair label="Due" value={detail.action.dueAt ?? null} />
            <TimestampPair label="Created" value={detail.action.createdAt} />
            <TimestampPair label="Updated" value={detail.action.updatedAt} />
            <TimestampPair label="Executed" value={detail.action.executedAt} />
            <TimestampPair label="Started" value={detail.action.savedAt} />
            <TimestampPair label="Skipped" value={detail.action.dismissedAt} />
            {!detail.action.dueAt ? <p className="text-sm text-[var(--vt-text-3)]">No due date is assigned to this action.</p> : null}
          </OpsCard>

          <OpsCard className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Status history</h2>
            {detail.action.statusEvents && detail.action.statusEvents.length > 0 ? detail.action.statusEvents.map((event) => (
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
            )) : (
              <p className="text-sm text-[var(--vt-text-3)]">No status transitions have been recorded for this action yet.</p>
            )}
          </OpsCard>

          <OpsCard className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">Prediction context</h2>
            {detail.action.linkedPredictions && detail.action.linkedPredictions.length > 0 ? detail.action.linkedPredictions.map((prediction) => (
              <div key={prediction.predictionId} className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <OpsBadge label={prediction.predictionType.replace(/_/g, ' ')} />
                  <span className="text-sm text-[var(--vt-text-3)]">Probability {Math.round(prediction.probability * 100)}%</span>
                  <span className="text-sm text-[var(--vt-text-3)]">Confidence {Math.round(prediction.confidence * 100)}%</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--vt-text-2)]">{prediction.explanation}</p>
              </div>
            )) : (
              <p className="text-sm text-[var(--vt-text-3)]">No linked prediction insights were returned for this action.</p>
            )}
          </OpsCard>
        </div>
      </div>
    </OperationsShell>
  );
}
