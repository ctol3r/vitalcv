import { createHash } from 'crypto';
import { getSource, Source } from './registry';

export interface EvidenceBundle {
  requestHash: string;
  responseHash: string;
  timestamp: number;
  reviewer?: string;
  standard: string; // e.g., "NCQA-2025", "CR1", "CR2"
  source: string;
  methodOfVerification: string; // e.g., "API", "Manual", "Document"
  result: 'verified' | 'failed' | 'pending';
  metadata?: Record<string, unknown>;
}

export interface PSVCheck {
  id: string;
  providerId: string;
  checkType: string; // e.g., "CR1", "CR2"
  sourceId: string;
  evidenceBundle: EvidenceBundle;
  createdAt: number;
  updatedAt: number;
}

/**
 * Compute hash of request/response for audit trail
 */
function computeHash(data: unknown): string {
  const json = JSON.stringify(data);
  return createHash('sha256').update(json).digest('hex');
}

/**
 * Create evidence bundle for a PSV check
 */
export function createEvidenceBundle(
  source: Source,
  request: unknown,
  response: unknown,
  standard: string,
  reviewer?: string,
  result: 'verified' | 'failed' | 'pending' = 'pending'
): EvidenceBundle {
  return {
    requestHash: computeHash(request),
    responseHash: computeHash(response),
    timestamp: Date.now(),
    reviewer,
    standard,
    source: source.id,
    methodOfVerification: 'API', // Could be 'API', 'Manual', 'Document'
    result,
    metadata: {
      sourceName: source.name,
      endpoint: source.endpoint,
      method: source.method,
    },
  };
}

/**
 * Store PSV check with evidence bundle
 * In production, this would persist to database
 */
const psvChecks: Map<string, PSVCheck> = new Map();

export function storePSVCheck(check: PSVCheck): void {
  psvChecks.set(check.id, check);
}

export function getPSVCheck(checkId: string): PSVCheck | null {
  return psvChecks.get(checkId) || null;
}

export function getPSVChecksForProvider(providerId: string): PSVCheck[] {
  return Array.from(psvChecks.values()).filter(c => c.providerId === providerId);
}

/**
 * Get all PSV checks (for aggregations)
 */
export function getAllPSVChecks(): PSVCheck[] {
  return Array.from(psvChecks.values());
}

/**
 * Verify freshness of PSV checks
 */
export function checkFreshness(check: PSVCheck, source: Source): boolean {
  const now = Date.now();
  const age = now - check.evidenceBundle.timestamp;

  const freshnessMs = source.freshnessWindow * (
    source.freshnessUnit === 'days' ? 86400000 :
    source.freshnessUnit === 'hours' ? 3600000 :
    60000
  );

  return age < freshnessMs;
}

