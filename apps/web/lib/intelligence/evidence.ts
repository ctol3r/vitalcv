import type { IntelligenceSystemHealth } from './contracts';
import type { InvestigatorFindingEvidence } from './detail-types';

export interface FindingEvidenceRow {
  id: string;
  sourceName: string;
  field: string;
  value: string;
  url: string | null;
  retrievedAt: string | null;
  confidence: number;
  degraded: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function humanizeToken(value: string | null | undefined): string {
  if (!value) {
    return 'Unknown';
  }

  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeSourceKey(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function formatValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    const formatted = value
      .map((entry) => formatValue(entry))
      .filter((entry): entry is string => Boolean(entry));
    return formatted.length > 0 ? formatted.join(', ') : null;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([key, entryValue]) => {
        const formatted = formatValue(entryValue);
        return formatted ? `${humanizeToken(key)}: ${formatted}` : null;
      })
      .filter((entry): entry is string => Boolean(entry));
    return entries.length > 0 ? entries.join(' · ') : null;
  }

  return null;
}

function deriveField(evidence: InvestigatorFindingEvidence): string {
  const metadata = asRecord(evidence.metadata);

  return (
    asString(metadata.field)
    ?? asString(metadata.claimType)
    ?? asString(metadata.edgeType)
    ?? evidence.recordType
    ?? evidence.evidenceType
    ?? 'Signal'
  );
}

function deriveValue(evidence: InvestigatorFindingEvidence): string {
  const metadata = asRecord(evidence.metadata);
  const candidate = (
    formatValue(metadata.value)
    ?? formatValue(metadata.values)
    ?? formatValue(metadata.score)
    ?? formatValue(metadata.scoreDelta)
    ?? formatValue(metadata.band)
    ?? evidence.snippet
    ?? evidence.recordId
  );

  return candidate ?? 'Pending corroboration';
}

function deriveRetrievedAt(evidence: InvestigatorFindingEvidence): string | null {
  const metadata = asRecord(evidence.metadata);

  return (
    asString(metadata.retrievedAt)
    ?? asString(metadata.retrievedAtUtc)
    ?? asString(metadata.fetchedAt)
    ?? asString(metadata.verifiedAt)
    ?? evidence.observedAt
    ?? null
  );
}

function deriveConfidence(evidence: InvestigatorFindingEvidence, fallbackConfidence: number): number {
  const metadata = asRecord(evidence.metadata);
  const candidate = (
    asNumber(metadata.confidence)
    ?? asNumber(metadata.confidenceScore)
    ?? fallbackConfidence
  );

  return Math.max(0, Math.min(1, candidate));
}

export function isEvidenceSourceDegraded(
  sourceName: string | null | undefined,
  health: Pick<IntelligenceSystemHealth, 'sources'> | null | undefined,
): boolean {
  if (!sourceName || !health) {
    return false;
  }

  const sourceKey = normalizeSourceKey(sourceName);
  if (sourceKey.length === 0) {
    return false;
  }

  return health.sources.some((source) => (
    normalizeSourceKey(source.source) === sourceKey
    && source.status !== 'OPERATIONAL'
  ));
}

export function buildFindingEvidenceRows(
  evidence: InvestigatorFindingEvidence[],
  fallbackConfidence: number,
  health: Pick<IntelligenceSystemHealth, 'sources'> | null | undefined,
): FindingEvidenceRow[] {
  return evidence
    .map((entry) => {
      const sourceName = entry.sourceLabel ?? entry.sourceId ?? 'Unknown source';
      return {
        id: entry.evidenceId,
        sourceName,
        field: humanizeToken(deriveField(entry)),
        value: deriveValue(entry),
        url: entry.url ?? null,
        retrievedAt: deriveRetrievedAt(entry),
        confidence: deriveConfidence(entry, fallbackConfidence),
        degraded: isEvidenceSourceDegraded(sourceName, health),
      };
    })
    .sort((left, right) => (
      right.confidence - left.confidence
      || Date.parse(right.retrievedAt ?? '') - Date.parse(left.retrievedAt ?? '')
      || left.sourceName.localeCompare(right.sourceName)
    ));
}
