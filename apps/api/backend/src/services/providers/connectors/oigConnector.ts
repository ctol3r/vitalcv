/**
 * oigConnector.ts — Production-hardened OIG Exclusion List Connector
 *
 * Checks the HHS OIG LEIE (List of Excluded Individuals/Entities)
 * for provider exclusion status via the monthly CSV cache.
 *
 * All sandbox/mock data has been removed. If the LEIE source is
 * unavailable, this connector throws SourceUnavailableError rather
 * than returning synthetic data.
 */

import { createHash } from 'node:crypto';
import { log } from '../../../obs/logger';
import { recordProvenance } from '../providerSourceProvenance';
import { runConnectorWithReliability } from './connectorReliability';
import { SourceUnavailableError } from '../../../utils/httpError';
import {
  leieCacheStats,
  lookupProvider,
  prewarmLeieCache,
} from '../../identity/leieCache';

export interface OIGExclusionResult {
  npi: string;
  excluded: boolean;
  verdict: 'CLEAR' | 'EXCLUDED' | 'UNCERTAIN' | 'REVIEW_REQUIRED';
  exclusionType: string | null;
  exclusionDate: string | null;
  reinstatementDate: string | null;
  waiverState: string | null;
  lastCheckedAt: string;
  sourceUrl: string;
  /** ISO 8601 timestamp of when this result was last verified against the live source. */
  lastVerifiedAt: string;
  /** Exact source URL or identifier for data provenance audit trail. */
  provenance: string;
}

export interface LeieExclusionRecord {
  npi: string;
  lastName: string;
  firstName: string;
  exclusionType: string;
  exclusionDate: string;
  reinstatementDate: string | null;
  waiverState: string | null;
}

export interface LeieIndexStatus {
  loaded: boolean;
  recordCount: number;
  lastLoadedAt: string | null;
  mode: string;
}

const OIG_LEIE_URL = 'https://oig.hhs.gov/exclusions/exclusions_list.asp';
const OIG_QUOTA_POLICY = {
  limit: 60,
  windowMs: 60_000,
};
const OIG_SCHEMA_POLICY = {
  requiredFields: ['npi', 'excluded', 'lastCheckedAt', 'sourceUrl'],
  allowAdditionalFields: true,
} as const;

// ── Public API ──────────────────────────────────────────────────────

export async function loadLeieData(): Promise<void> {
  prewarmLeieCache();
  await lookupProvider({ npi: '' });
}

export async function checkOIGExclusion(npi: string): Promise<OIGExclusionResult> {
  return runConnectorWithReliability<OIGExclusionResult>({
    connector: 'OIG',
    quotaPolicy: OIG_QUOTA_POLICY,
    schemaPolicy: OIG_SCHEMA_POLICY,
    execute: async () => {
      const result = await lookupProvider({ npi });
      const now = result.checkedAt;

      if (result.cacheAge === 'unavailable') {
        throw new SourceUnavailableError(
          'OIG_LEIE',
          OIG_LEIE_URL,
          'LEIE monthly CSV cache could not be loaded. Cannot verify exclusion status.',
        );
      }

      if (result.cacheAge !== 'fresh' || result.verdict === 'UNCHECKED') {
        throw new SourceUnavailableError(
          'OIG_LEIE',
          OIG_LEIE_URL,
          `LEIE cache is ${result.cacheAge}. Cannot provide authoritative exclusion status.`,
        );
      }

      if (result.verdict === 'POSSIBLE_MATCH') {
        return {
          npi,
          excluded: false,
          verdict: 'REVIEW_REQUIRED',
          exclusionType: result.entry?.exclusionType ?? null,
          exclusionDate: result.entry?.exclusionDate ?? null,
          reinstatementDate: result.entry?.reinstatementDate ?? null,
          waiverState: result.entry?.waiverState ?? null,
          lastCheckedAt: now,
          sourceUrl: OIG_LEIE_URL,
          lastVerifiedAt: now,
          provenance: OIG_LEIE_URL,
        };
      }

      if (result.verdict === 'EXCLUDED') {
        return {
          npi,
          excluded: true,
          verdict: 'EXCLUDED',
          exclusionType: result.entry?.exclusionType ?? null,
          exclusionDate: result.entry?.exclusionDate ?? null,
          reinstatementDate: result.entry?.reinstatementDate ?? null,
          waiverState: result.entry?.waiverState ?? null,
          lastCheckedAt: now,
          sourceUrl: OIG_LEIE_URL,
          lastVerifiedAt: now,
          provenance: OIG_LEIE_URL,
        };
      }

      return {
        npi,
        excluded: false,
        verdict: 'CLEAR',
        exclusionType: null,
        exclusionDate: null,
        reinstatementDate: null,
        waiverState: null,
        lastCheckedAt: now,
        sourceUrl: OIG_LEIE_URL,
        lastVerifiedAt: now,
        provenance: OIG_LEIE_URL,
      };
    },
    afterSuccess: async (result) => {
      recordProvenance({
        npi,
        source: 'OIG',
        sourceUrl: OIG_LEIE_URL,
        rawPayload: result,
      });
    },
    onFailure: ({ reason, stage, error }) => {
      log('error', 'oig_connector: check failed', {
        npi,
        error: error?.message ?? reason,
        stage,
      });
    },
    fallback: ({ reason }) => {
      throw new SourceUnavailableError('OIG_LEIE', OIG_LEIE_URL, reason);
    },
  });
}

export function getLeieIndexStatus(): LeieIndexStatus {
  const stats = leieCacheStats();

  return {
    loaded: stats.loaded,
    recordCount: stats.entries,
    lastLoadedAt:
      stats.loaded && stats.ageMs >= 0
        ? new Date(Date.now() - stats.ageMs).toISOString()
        : null,
    mode: 'live',
  };
}
