export type NextBestActionKind =
  | 'PROCEED'
  | 'REVERIFY'
  | 'ESCALATE'
  | 'REVIEW_MANUALLY';

export interface NextBestActionPayload {
  action?: unknown;
  reason?: unknown;
  confidence?: unknown;
  evidenceCount?: unknown;
}

export type NextBestActionInput = NextBestActionPayload;

export interface NormalizedNextBestAction {
  kind: NextBestActionKind;
  title: string;
  description: string;
  actionLabel: string;
  confidence: number;
  confidenceLabel: 'HIGH' | 'MEDIUM' | 'LOW';
  evidenceCount: number;
  href?: string;
  onClick?: () => void;
  isFailure?: boolean;
}

const DEFAULT_COPY: Record<NextBestActionKind, Pick<NormalizedNextBestAction, 'title' | 'actionLabel'>> = {
  PROCEED: {
    title: 'Ready to share',
    actionLabel: 'Proceed',
  },
  REVERIFY: {
    title: 'Refresh verification',
    actionLabel: 'Reverify',
  },
  ESCALATE: {
    title: 'Needs review',
    actionLabel: 'Escalate',
  },
  REVIEW_MANUALLY: {
    title: 'Review this profile',
    actionLabel: 'Review manually',
  },
};

const KIND_LABELS: Record<NextBestActionKind, string> = {
  PROCEED: 'Proceed',
  REVERIFY: 'Needs refresh',
  ESCALATE: 'Needs review',
  REVIEW_MANUALLY: 'Manual review',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeToken(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

  return normalized.length > 0 ? normalized : null;
}

function normalizeKind(value: unknown): NextBestActionKind | null {
  const normalized = normalizeToken(value);
  if (
    normalized === 'PROCEED'
    || normalized === 'REVERIFY'
    || normalized === 'ESCALATE'
    || normalized === 'REVIEW_MANUALLY'
  ) {
    return normalized;
  }
  return null;
}

function normalizeReason(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : null;
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }

  const ratio = value > 1 ? value / 100 : value;
  return Math.max(0, Math.min(1, ratio));
}

function normalizeEvidenceCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.round(value);
}

export function getNextBestActionConfidenceLabel(confidence: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (confidence >= 0.85) {
    return 'HIGH';
  }
  if (confidence >= 0.6) {
    return 'MEDIUM';
  }
  return 'LOW';
}

export function getNextBestActionKindLabel(kind: NextBestActionKind): string {
  return KIND_LABELS[kind];
}

export function normalizeNextBestAction(
  payload?: NextBestActionPayload | null,
): NormalizedNextBestAction | null {
  if (!isRecord(payload)) {
    return null;
  }

  const kind = normalizeKind(payload.action);
  if (!kind) {
    return null;
  }

  const confidence = normalizeConfidence(payload.confidence);
  const reason = normalizeReason(payload.reason);

  return {
    kind,
    title: DEFAULT_COPY[kind].title,
    description: reason ?? 'No rationale was returned with this recommendation.',
    actionLabel: DEFAULT_COPY[kind].actionLabel,
    confidence,
    confidenceLabel: getNextBestActionConfidenceLabel(confidence),
    evidenceCount: normalizeEvidenceCount(payload.evidenceCount),
  };
}

export function buildNextBestActionApiFailure(): NormalizedNextBestAction {
  return {
    kind: 'REVIEW_MANUALLY',
    title: 'Next best action unavailable',
    description: 'We could not load a recommendation right now.',
    actionLabel: 'Unavailable',
    confidence: 0,
    confidenceLabel: 'LOW',
    evidenceCount: 0,
    isFailure: true,
  };
}
