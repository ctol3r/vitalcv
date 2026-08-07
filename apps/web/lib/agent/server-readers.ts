/**
 * Production CanonicalReaders wiring.
 *
 * Reads: the web NPPES adapter directly; ownership, profile, coverage, and
 * opportunities over the backend HTTP surface with canonical identity
 * headers; the agent consent ledger and action history from the web-side
 * stores. Mapping is defensive: an answer in an unexpected shape (or a
 * non-OK status) becomes null / a thrown error, which the assembler reports
 * as an input gap — never a guessed state.
 *
 * Executions (A1): the canonical trust-state refresh (Level 2) and the
 * canonical apply-share with server-resolved recipient (Level 3 — the
 * registry additionally requires a ConsentProof, and the backend route
 * itself refuses unless NPI ownership is verified or delegated). Both
 * require the backend to run Clerk JWT verification in shadow/enforce mode;
 * in `off` mode the verified-identity routes 401 and execution degrades to
 * an honest failure, never a fake success.
 */
import 'server-only';
import { buildIdentityHeaders } from '@/lib/auth/forwardIdentity';
import { BACKEND_URL as B } from '@/lib/backend-url';
import { fetchNppesRecord } from '@/lib/clinician-record/nppes';
import { readAgentConsentStates } from './consent/consent-store';
import { readAgentActionHistory } from './telemetry/agent-run-store';
import type { CanonicalReaders } from './tools/canonical-tools';

async function backendRequest(
  method: 'GET' | 'POST',
  path: string,
  userId: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${B}${path}`, {
    method,
    headers: {
      ...(await buildIdentityHeaders({ userId })),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  });
  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }
  return { status: response.status, body: parsed };
}

async function backendGet(path: string, userId: string): Promise<{ status: number; body: unknown }> {
  return backendRequest('GET', path, userId);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function buildProductionReaders(userId: string): CanonicalReaders {
  return {
    async readNppesIdentity(npi) {
      const result = await fetchNppesRecord(npi);
      if (!result) return null;
      return { found: true, retrievedAt: result.retrievedAt };
    },

    async readOwnershipState(npi) {
      const { status, body } = await backendGet(`/api/ownership/state/${npi}`, userId);
      if (status === 404) return null;
      if (status !== 200) throw new Error(`ownership read failed with ${status}`);
      const record = asRecord(body);
      const view = asRecord(record?.ownership) ?? record;
      const state = typeof view?.state === 'string' ? view.state : null;
      if (!state) return null;
      return { state };
    },

    async readProfileCompleteness() {
      const { status, body } = await backendGet('/api/profile/completeness', userId);
      if (status !== 200) return null;
      const record = asRecord(body);
      const score = typeof record?.score === 'number' ? record.score : null;
      if (score === null) return null;
      const dimensions = asRecord(record?.dimensions) ?? {};
      const missingFields = Object.entries(dimensions)
        .filter(([, satisfied]) => satisfied === false)
        .map(([name]) => name);
      return { score, missingFields };
    },

    async readSourceCoverage(npi) {
      const { status, body } = await backendGet(`/api/trust-state/${npi}`, userId);
      if (status !== 200) return null;
      const record = asRecord(body);
      const coverage = asRecord(record?.sourceCoverage);
      const checks = Array.isArray(coverage?.checks) ? coverage.checks : null;
      if (!checks) return null;
      const mapped: Array<{ sourceId: string; state: string; checkedAt?: string | null }> = [];
      for (const raw of checks) {
        const check = asRecord(raw);
        if (!check || typeof check.sourceId !== 'string' || typeof check.state !== 'string') continue;
        const freshness = asRecord(check.freshness);
        mapped.push({
          sourceId: check.sourceId,
          state: check.state,
          checkedAt: typeof freshness?.checkedAt === 'string' ? freshness.checkedAt : null,
        });
      }
      return mapped;
    },

    async readOpportunities(npi) {
      const { status, body } = await backendGet(`/api/matcha/opportunities/${npi}`, userId);
      if (status !== 200) return null;
      const record = asRecord(body);
      const matches = Array.isArray(record?.matches) ? record.matches : null;
      if (!matches) return null;
      const opportunityRefs: string[] = [];
      for (const raw of matches) {
        const match = asRecord(raw);
        if (match && typeof match.opportunityId === 'string') {
          opportunityRefs.push(match.opportunityId);
        }
      }
      return { opportunityRefs };
    },

    async readAgentConsents(subjectRef) {
      return readAgentConsentStates(subjectRef);
    },

    async readActionHistory(subjectRef) {
      return readAgentActionHistory(subjectRef);
    },

    async triggerSourceRefresh(npi) {
      const { status, body } = await backendRequest(
        'POST',
        `/api/trust-state/${npi}/refresh`,
        userId,
        {},
      );
      if (status !== 200) return null;
      const record = asRecord(body);
      const computedAt =
        typeof record?.computed_at === 'string'
          ? record.computed_at
          : typeof record?.computedAt === 'string'
            ? record.computedAt
            : undefined;
      return { requested: true, ...(computedAt ? { computedAt } : {}) };
    },

    async executeApplyShare(input) {
      const { status, body } = await backendRequest('POST', '/api/apply/share', userId, {
        npi: input.npi,
        // The recipient is server-resolved from the opportunity; these fields
        // are the required envelope the resolver overwrites.
        organization_context: {
          organization_id: 'agent-consented-share',
          name: 'Consented agent share (server-resolved recipient)',
          purpose_of_use: input.purpose,
        },
        opportunityId: input.opportunityRef,
      });
      if (status === 403) return { blocked: 'canonical_ownership_authz' };
      if (status !== 200 && status !== 201) return null;
      const record = asRecord(body);
      if (!record || typeof record.shareId !== 'string') return null;
      const recipient = asRecord(record.recipient);
      return {
        shareId: record.shareId,
        ...(typeof recipient?.name === 'string' ? { recipientName: recipient.name } : {}),
        status: typeof record.status === 'string' ? record.status : 'unknown',
        ...(typeof record.sharedAt === 'string' ? { sharedAt: record.sharedAt } : {}),
      };
    },
  };
}
