import { randomUUID } from 'node:crypto';

export const SCREENING_COMPONENT_KEYS = ['license', 'board', 'experience', 'compact'] as const;
export type ScreeningComponentKey = (typeof SCREENING_COMPONENT_KEYS)[number] | string;

export type ScreeningComponentStatus = 'pass' | 'fail' | 'review';

export interface ScreeningComponent {
  key: ScreeningComponentKey;
  status: ScreeningComponentStatus;
  detail: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface AtsCandidateDelivery {
  clinicianId: string;
  orgId?: string | null;
  readinessScore?: number | null;
  readinessLabel?: string;
  screening?: {
    verdict: ScreeningComponentStatus | 'approved';
    components: ScreeningComponent[];
  };
  bundle?: unknown;
  profile?: {
    fullName?: string;
    email?: string;
    phone?: string;
    specialty?: string;
    location?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface AtsConnectorResponse {
  delivered: boolean;
  statusCode?: number;
  requestId: string;
  message?: string;
  body?: unknown;
  error?: string;
  timestamp: string;
}

export interface AtsRoleSummary {
  id: string;
  title: string;
  location?: string;
  department?: string;
  openings?: number;
  updatedAt?: string;
  raw?: Record<string, unknown> | null;
}

export interface AtsConnectorHealth {
  ok: boolean;
  lastChecked: string;
  latencyMs?: number;
  message?: string;
}

export interface AtsConnector {
  name: string;
  pushCandidate(payload: AtsCandidateDelivery): Promise<AtsConnectorResponse>;
  fetchOpenRoles?(options?: { limit?: number }): Promise<AtsRoleSummary[]>;
  getHealth?(): Promise<AtsConnectorHealth>;
}

export interface ConnectorOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface EmployerAtsRecord {
  id: string;
  orgId: string;
  name: string;
  apiUrl?: string | null;
  apiKey?: string | null;
}

export function ensureRequestId(hint?: string): string {
  if (hint && hint.trim().length > 0) {
    return hint.trim();
  }
  return randomUUID();
}

export function normalizeBaseUrl(url: string | null | undefined, fallback?: string): string {
  const candidate = (url ?? '').trim();
  if (!candidate && fallback) {
    return ensureTrailingSlash(fallback);
  }
  if (!candidate) {
    return '';
  }
  try {
    const normalized = candidate.startsWith('http') ? candidate : `https://${candidate}`;
    const asUrl = new URL(normalized);
    return ensureTrailingSlash(asUrl.toString());
  } catch {
    return ensureTrailingSlash(candidate);
  }
}

export function ensureTrailingSlash(value: string): string {
  if (!value) {
    return value;
  }
  return value.endsWith('/') ? value : `${value}/`;
}

export function buildUnconfiguredResponse(
  connector: string,
  reason: string,
  requestId = ensureRequestId(),
): AtsConnectorResponse {
  return {
    delivered: false,
    statusCode: 0,
    requestId,
    error: reason,
    message: `${connector} connector is not configured`,
    timestamp: new Date().toISOString(),
  };
}









