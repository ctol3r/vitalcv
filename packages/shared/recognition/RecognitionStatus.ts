export const RECOGNITION_STATUSES = ['ACTIVE', 'REVOKED', 'EXPIRED'] as const;

export type RecognitionStatus = (typeof RECOGNITION_STATUSES)[number];

export type RecognitionStatusInput = Readonly<{
  recognizedAt: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
  asOf?: string;
}>;

function parseTimestamp(value: string, field: string): number {
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) {
    throw new Error(`${field} must be an ISO timestamp`);
  }

  return ts;
}

export function resolveRecognitionStatus(input: RecognitionStatusInput): RecognitionStatus {
  const asOf = input.asOf ?? new Date().toISOString();
  const asOfTs = parseTimestamp(asOf, 'asOf');
  parseTimestamp(input.recognizedAt, 'recognizedAt');

  if (input.revokedAt) {
    parseTimestamp(input.revokedAt, 'revokedAt');
    return 'REVOKED';
  }

  if (input.expiresAt) {
    const expiresTs = parseTimestamp(input.expiresAt, 'expiresAt');
    if (asOfTs > expiresTs) {
      return 'EXPIRED';
    }
  }

  return 'ACTIVE';
}
