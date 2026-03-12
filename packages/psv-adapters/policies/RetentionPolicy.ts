import type { CredentialFactBatch } from '../core/CredentialFactMapper';
import type { SourcePolicyDefinition } from './SourcePolicy';

export type RetentionWindowEvaluation = Readonly<{
  rawPayloadExpiresAt: string;
  evidencePointerExpiresAt: string;
  factsExpireAt: string;
}>;

function addDays(isoTimestamp: string, days: number): string {
  const date = new Date(isoTimestamp);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function evaluateRetentionWindows(
  batch: CredentialFactBatch,
  sourcePolicy: SourcePolicyDefinition,
): RetentionWindowEvaluation {
  return Object.freeze({
    rawPayloadExpiresAt: addDays(batch.retrievalTime, sourcePolicy.retentionDays.rawPayload),
    evidencePointerExpiresAt: addDays(
      batch.retrievalTime,
      sourcePolicy.retentionDays.evidencePointer,
    ),
    factsExpireAt: addDays(batch.retrievalTime, sourcePolicy.retentionDays.facts),
  });
}

export function isRetentionExpired(window: RetentionWindowEvaluation, nowIso: string): boolean {
  return (
    Date.parse(window.rawPayloadExpiresAt) <= Date.parse(nowIso) &&
    Date.parse(window.evidencePointerExpiresAt) <= Date.parse(nowIso) &&
    Date.parse(window.factsExpireAt) <= Date.parse(nowIso)
  );
}
