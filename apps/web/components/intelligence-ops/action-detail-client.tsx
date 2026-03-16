'use client';

import { useAction } from '@/hooks/useIntelligenceDetail';
import type { ActionDetailResponse } from '@/lib/intelligence/detail-types';
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
      title={detail.action.recommendedAction}
      description={detail.action.explanation}
      breadcrumbs={[
        { label: 'Actions', href: backHref },
        { label: 'Detail' },
      ]}
      meta={(
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Action detail</p>
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
                  <EntityLink href={`/investigations?npi=${providerNpi}`} label="Open investigation" />
                </>
              ) : null}
              {detail.action.targetEntity.entityLabel && !providerNpi ? (
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                  {detail.action.targetEntity.entityLabel}
                </span>
              ) : null}
              {detail.action.sourceFindingIds[0] ? (
                <EntityLink
                  href={`/findings/${detail.action.sourceFindingIds[0]}?from=/actions/${actionId}`}
                  label={`Finding ${detail.action.sourceFindingIds[0]}`}
                />
              ) : null}
            </div>
            <p className="text-sm leading-7 text-slate-300">{detail.action.explanation}</p>
          </OpsCard>

          <OpsCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Evidence</h2>
              <span className="text-sm text-slate-400">{detail.action.evidence.length} items</span>
            </div>
            {detail.action.evidence.length > 0 ? (
              <div className="space-y-3">
                {detail.action.evidence.map((evidence, index) => (
                  <div key={`${evidence.label}-${index}`} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <OpsBadge label={evidence.label} />
                      {evidence.source ? <span className="text-sm text-slate-400">{evidence.source}</span> : null}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{evidence.snippet ?? 'No evidence snippet recorded.'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No evidence has been attached to this action.</p>
            )}
          </OpsCard>

          <OpsCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Related findings</h2>
              <span className="text-sm text-slate-400">{detail.action.sourceFindingIds.length} linked findings</span>
            </div>
            {detail.action.sourceFindingIds.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {detail.action.sourceFindingIds.map((findingId) => (
                  <EntityLink key={findingId} href={`/findings/${findingId}?from=/actions/${actionId}`} label={`Finding ${findingId}`} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">This action is not linked to any finding records.</p>
            )}
          </OpsCard>
        </div>

        <div className="space-y-4">
          <OpsCard className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Triage</h2>
            <ActionMutationControls actionId={detail.action.actionId} status={detail.action.status} />
          </OpsCard>

          <OpsCard className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Queue metrics</h2>
            <p className="text-sm text-slate-300">Priority score {Math.round(detail.action.priorityScore)}</p>
            <p className="text-sm text-slate-300">Confidence {Math.round(detail.action.confidence * 100)}%</p>
            <TimestampPair label="Due" value={detail.action.dueAt ?? null} />
            <TimestampPair label="Created" value={detail.action.createdAt} />
            <TimestampPair label="Updated" value={detail.action.updatedAt} />
            <TimestampPair label="Executed" value={detail.action.executedAt} />
            <TimestampPair label="Started" value={detail.action.savedAt} />
            <TimestampPair label="Skipped" value={detail.action.dismissedAt} />
            {!detail.action.dueAt ? <p className="text-sm text-slate-400">No due date is assigned to this action.</p> : null}
          </OpsCard>

          <OpsCard className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Status history</h2>
            {detail.action.statusEvents && detail.action.statusEvents.length > 0 ? detail.action.statusEvents.map((event) => (
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
            )) : (
              <p className="text-sm text-slate-400">No status transitions have been recorded for this action yet.</p>
            )}
          </OpsCard>

          <OpsCard className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Prediction context</h2>
            {detail.action.linkedPredictions && detail.action.linkedPredictions.length > 0 ? detail.action.linkedPredictions.map((prediction) => (
              <div key={prediction.predictionId} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <OpsBadge label={prediction.predictionType.replace(/_/g, ' ')} />
                  <span className="text-sm text-slate-400">Probability {Math.round(prediction.probability * 100)}%</span>
                  <span className="text-sm text-slate-400">Confidence {Math.round(prediction.confidence * 100)}%</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{prediction.explanation}</p>
              </div>
            )) : (
              <p className="text-sm text-slate-400">No linked prediction insights were returned for this action.</p>
            )}
          </OpsCard>
        </div>
      </div>
    </OperationsShell>
  );
}
