/**
 * triggerReverify.ts — thin orchestration on top of existing audit +
 * event chain.
 *
 * Takes a DriftEvent (or just-detected drift result from driftDetector)
 * and emits a REVERIFY_REQUIRED follow-up via:
 *   - the existing services/audit/eventWriter.logEvent helper, so the
 *     event is persisted to the AuditEvent chain with the right
 *     subjectNpi + manifest correlation
 *   - the existing services/events/eventBus emit, so any in-process
 *     reaction handler (notifications, KPI metric writes, etc.) can
 *     subscribe without us building a new pipeline
 *
 * MUST NOT introduce a new model or a new event store — this is pure
 * routing on top of what already ships. Best-effort: failures log and
 * swallow so a misbehaving reaction can never block a continuous
 * monitoring loop.
 */

import { logEvent } from '../audit/eventWriter';
import { emit } from '../events/eventBus';
import { log } from '../../obs/logger';

export const REVERIFY_REQUIRED_EVENT = 'REVERIFY_REQUIRED';
export const REVERIFY_AUDIT_TYPE = 'monitoring.reverify_required';

export interface TriggerReverifyInput {
  /** DriftEvent.id when persisted, or a deterministic ad-hoc id from the detector. */
  driftEventId?: string | null;
  subjectNpi: string;
  source: string;
  driftType: string;
  /** Optional reference to the manifest the action will eventually be taken against. */
  manifestId?: string | null;
  /** Optional human-readable reason; falls back to "<source>: <driftType>". */
  reason?: string;
  /** Optional severity passthrough — defaults to 'medium'. */
  severity?: 'low' | 'medium' | 'high';
  /** Optional payload extras carried into both the audit metadata and event payload. */
  extras?: Record<string, unknown>;
}

export interface TriggerReverifyResult {
  emitted: boolean;
  reason: string;
}

export async function triggerReverify(
  input: TriggerReverifyInput,
): Promise<TriggerReverifyResult> {
  const subjectNpi = input.subjectNpi?.trim();
  const source = input.source?.trim();
  const driftType = input.driftType?.trim();

  if (!subjectNpi || !source || !driftType) {
    log('warn', 'reverify_trigger_invalid_input', {
      has_npi: Boolean(subjectNpi),
      has_source: Boolean(source),
      has_drift_type: Boolean(driftType),
    });
    return { emitted: false, reason: 'invalid_input' };
  }

  const reason = input.reason?.trim() || `${source}: ${driftType}`;
  const severity = input.severity ?? 'medium';
  const detectedAt = new Date().toISOString();

  // (1) Audit-chain row via the existing eventWriter helper. outputsHash
  //     is intentionally left null — the caller's DriftEvent row already
  //     carries the canonical digest of what changed.
  await logEvent({
    eventType: REVERIFY_AUDIT_TYPE,
    subjectNpi,
    referenceId: input.manifestId ?? input.driftEventId ?? null,
    metadata: {
      action: 'REVERIFY_REQUIRED',
      driftEventId: input.driftEventId ?? null,
      manifestId: input.manifestId ?? null,
      source,
      driftType,
      severity,
      reason,
      detectedAt,
      ...(input.extras ?? {}),
    },
  });

  // (2) In-process bus emit so existing reaction handlers (notifications,
  //     KPI metric writes) can subscribe without us building a new path.
  await emit({
    type: REVERIFY_REQUIRED_EVENT,
    clinicianNpi: subjectNpi,
    source,
    severity,
    timestamp: detectedAt,
    payload: {
      driftEventId: input.driftEventId ?? null,
      manifestId: input.manifestId ?? null,
      driftType,
      reason,
      action: 'REVERIFY_REQUIRED',
      ...(input.extras ?? {}),
    },
  });

  return { emitted: true, reason };
}
