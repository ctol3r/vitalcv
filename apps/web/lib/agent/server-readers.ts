/**
 * Production CanonicalReaders wiring for the A0 route.
 *
 * Each reader is a thin, read-only call into an existing canonical
 * capability — the web NPPES adapter directly, everything else over the
 * backend HTTP surface with the canonical identity headers. Mapping is
 * defensive: an answer in an unexpected shape (or a non-OK status) becomes
 * null / a thrown error, which the assembler reports as an input gap — never
 * a guessed state.
 *
 * Not yet wired in A0 (returns null → honest input gap, visible in the
 * response and telemetry): opportunity retrieval. It lands with A1's tool
 * work rather than guessing a backend path here.
 */
import 'server-only';
import { buildIdentityHeaders } from '@/lib/auth/forwardIdentity';
import { BACKEND_URL as B } from '@/lib/backend-url';
import { fetchNppesRecord } from '@/lib/clinician-record/nppes';
import type { CanonicalReaders } from './tools/canonical-tools';

async function backendGet(path: string, userId: string): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${B}${path}`, {
    headers: { ...(await buildIdentityHeaders({ userId })) },
    cache: 'no-store',
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
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

    async readOpportunities() {
      return null;
    },
  };
}
