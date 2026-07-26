/**
 * VitalCV Platform SDK (Wave 330, C4) — a typed client over the public platform
 * contract. Strengthens SDK contracts: every method returns the typed projection,
 * and the response is validated against the endpoint's declared schema version
 * before it is handed back (fail-closed on contract drift).
 *
 * `fetch` is injectable so the SDK runs in any environment (Node, edge, browser)
 * and is testable against the real route handlers.
 */

import type {
  EvidenceCollection,
  IntelligenceProjection,
  MobilityOverview,
  OrganizationGraph,
  ReadinessProjection,
  TimelineProjection,
  TrustProjection,
} from '@vitalcv/domain-evidence';
import {
  PLATFORM_API_VERSION,
  PLATFORM_ENDPOINTS,
  isPlatformSchema,
  platformPath,
  type PlatformEndpointId,
} from './contract';

export interface VitalCVClientOptions {
  baseUrl: string;
  /** Injected fetch; defaults to global fetch when available. */
  fetch?: typeof fetch;
  /** Optional bearer credential for gated deployments. */
  apiKey?: string;
}

export class PlatformContractError extends Error {
  constructor(message: string, readonly endpoint: PlatformEndpointId, readonly status?: number) {
    super(message);
    this.name = 'PlatformContractError';
  }
}

export interface VitalCVClient {
  readonly version: typeof PLATFORM_API_VERSION;
  getEvidence(entityId: string): Promise<EvidenceCollection>;
  getTrust(entityId: string): Promise<TrustProjection>;
  getTimeline(entityId: string): Promise<TimelineProjection>;
  getMobility(entityId: string): Promise<MobilityOverview>;
  getMobilityReadiness(entityId: string, state?: string): Promise<ReadinessProjection>;
  getOrganizations(entityId: string): Promise<OrganizationGraph>;
  getIntelligence(entityId: string): Promise<IntelligenceProjection>;
}

export function createVitalCVClient(opts: VitalCVClientOptions): VitalCVClient {
  const doFetch = opts.fetch ?? globalThis.fetch;
  if (!doFetch) throw new Error('No fetch implementation available; pass options.fetch.');
  const base = opts.baseUrl.replace(/\/$/, '');

  async function get<T>(id: PlatformEndpointId, entityId: string, query?: string): Promise<T> {
    const endpoint = PLATFORM_ENDPOINTS.find((e) => e.id === id)!;
    const url = `${base}${platformPath(id, entityId)}${query ?? ''}`;
    const res = await doFetch(url, {
      headers: { Accept: 'application/json', ...(opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {}) },
    });
    if (!res.ok) {
      throw new PlatformContractError(`Platform request failed (${res.status}) for ${id}.`, id, res.status);
    }
    const body = (await res.json()) as { schema?: unknown };
    if (!isPlatformSchema(body.schema)) {
      throw new PlatformContractError(`Response for ${id} is not a versioned platform contract.`, id, res.status);
    }
    if (body.schema !== endpoint.schema) {
      throw new PlatformContractError(`Schema mismatch for ${id}: expected ${endpoint.schema}, got ${String(body.schema)}.`, id, res.status);
    }
    return body as T;
  }

  return {
    version: PLATFORM_API_VERSION,
    getEvidence: (entityId) => get('evidence', entityId),
    getTrust: (entityId) => get('trust', entityId),
    getTimeline: (entityId) => get('timeline', entityId),
    getMobility: (entityId) => get('mobility', entityId),
    getMobilityReadiness: (entityId, state) => get('mobility-readiness', entityId, state ? `?state=${encodeURIComponent(state)}` : undefined),
    getOrganizations: (entityId) => get('organizations', entityId),
    getIntelligence: (entityId) => get('intelligence', entityId),
  };
}
