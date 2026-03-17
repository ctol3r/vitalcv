'use client';

import { cn } from '@/lib/utils';
import {
  formatFreshnessLabel,
  type FreshnessMarker,
  type SourceQualityMarker,
  type TrustSignalSummary,
} from '@/lib/intelligence/trust-signals';
import { OpsBadge, type BadgeTone } from './primitives';

function confidenceTone(band: TrustSignalSummary['confidenceBand']): BadgeTone {
  switch (band) {
    case 'HIGH':
      return 'success';
    case 'MEDIUM':
      return 'info';
    case 'LOW':
    default:
      return 'warning';
  }
}

function evidenceQualityTone(value: TrustSignalSummary['evidenceQuality']): BadgeTone {
  switch (value) {
    case 'STRONG':
      return 'success';
    case 'ADEQUATE':
      return 'info';
    case 'WEAK':
      return 'warning';
    case 'MISSING':
    default:
      return 'neutral';
  }
}

function freshnessTone(value: FreshnessMarker): BadgeTone {
  switch (value) {
    case 'FRESH':
      return 'success';
    case 'AGING':
      return 'warning';
    case 'STALE':
      return 'critical';
    case 'UNKNOWN':
    default:
      return 'neutral';
  }
}

function sourceQualityTone(value: SourceQualityMarker): BadgeTone {
  switch (value) {
    case 'AUTHORITATIVE':
      return 'success';
    case 'MIXED':
      return 'info';
    case 'DERIVED':
      return 'warning';
    case 'UNKNOWN':
    default:
      return 'neutral';
  }
}

function sourceQualityLabel(value: SourceQualityMarker): string {
  switch (value) {
    case 'AUTHORITATIVE':
      return 'Authoritative source';
    case 'DERIVED':
      return 'Derived signal';
    case 'MIXED':
      return 'Mixed provenance';
    case 'UNKNOWN':
    default:
      return 'Source quality unknown';
  }
}

function corroborationLabel(summary: TrustSignalSummary): string {
  if (summary.uniqueSourceCount === 0) {
    return 'No corroboration';
  }

  if (summary.corroborationCount > 0) {
    return `${summary.corroborationCount} corroborations`;
  }

  return summary.uniqueSourceCount > 1
    ? `${summary.uniqueSourceCount} sources`
    : 'Single source';
}

export function TrustSignalChips({
  summary,
  confidence,
  showConfidence = false,
  className,
}: {
  summary: TrustSignalSummary;
  confidence?: number | null;
  showConfidence?: boolean;
  className?: string;
}) {
  const confidenceLabel = confidence != null
    ? `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}% confidence`
    : `${summary.confidenceBand} confidence`;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {showConfidence ? (
        <OpsBadge label={confidenceLabel} tone={confidenceTone(summary.confidenceBand)} />
      ) : null}
      <OpsBadge label={`${summary.evidenceQuality} evidence`} tone={evidenceQualityTone(summary.evidenceQuality)} />
      <OpsBadge
        label={formatFreshnessLabel(summary.freshness, summary.lastObservedAt)}
        tone={freshnessTone(summary.freshness)}
      />
      <OpsBadge label={corroborationLabel(summary)} tone={summary.corroborationCount > 0 ? 'success' : 'neutral'} />
      <OpsBadge label={sourceQualityLabel(summary.sourceQuality)} tone={sourceQualityTone(summary.sourceQuality)} />
    </div>
  );
}
