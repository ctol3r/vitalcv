/**
 * npdbConnector.ts — Wave 127: NPDB Connector (Scaffold)
 *
 * Queries the National Practitioner Data Bank for adverse actions
 * and malpractice payments.
 *
 * Sandbox: 95% CLEAR / 5% FLAGGED via NPI hash
 * Live: NPDB PROACT API (integration TBD — requires org enrollment)
 */

import { createHash } from 'node:crypto';
import { log } from '../../../obs/logger';
import { recordProvenance } from '../providerSourceProvenance';
import { getConnectorMode } from './connectorFactory';
import { runConnectorWithReliability } from './connectorReliability';

export interface NPDBQueryResult {
  npi: string;
  adverseActionCount: number;
  malpracticePayments: number;
  licenseActions: number;
  status: 'CLEAR' | 'FLAGGED' | 'NOT_AVAILABLE';
  lastCheckedAt: string;
  sourceUrl: string;
}

const NPDB_URL = 'https://www.npdb.hrsa.gov';
const NPDB_QUOTA_POLICY = {
  limit: 250,
  windowMs: 60_000,
};
const NPDB_SCHEMA_POLICY = {
  requiredFields: ['npi', 'status', 'lastCheckedAt', 'sourceUrl'],
  allowAdditionalFields: true,
} as const;

// ── Sandbox ─────────────────────────────────────────────────────────

function sandboxQuery(npi: string): NPDBQueryResult {
  const hash = createHash('sha256').update(`npdb:${npi}`).digest('hex');
  const lastByte = parseInt(hash.slice(-2), 16);
  // ~5% FLAGGED (lastByte >= 243)
  const flagged = lastByte >= 243;

  if (flagged) {
    const actions = (lastByte % 3) + 1;
    return {
      npi,
      adverseActionCount: actions,
      malpracticePayments: actions > 1 ? 1 : 0,
      licenseActions: 1,
      status: 'FLAGGED',
      lastCheckedAt: new Date().toISOString(),
      sourceUrl: NPDB_URL,
    };
  }

  return {
    npi,
    adverseActionCount: 0,
    malpracticePayments: 0,
    licenseActions: 0,
    status: 'CLEAR',
    lastCheckedAt: new Date().toISOString(),
    sourceUrl: NPDB_URL,
  };
}

// ── Public API ──────────────────────────────────────────────────────

export async function queryNPDB(npi: string): Promise<NPDBQueryResult> {
  const mode = getConnectorMode('NPDB');

  return runConnectorWithReliability({
    connector: 'NPDB',
    quotaPolicy: NPDB_QUOTA_POLICY,
    schemaPolicy: NPDB_SCHEMA_POLICY,
    execute: async () => {
      if (mode === 'live') {
        log('info', 'npdb_connector: live PROACT API not yet implemented', { npi });
        return {
          npi,
          adverseActionCount: 0,
          malpracticePayments: 0,
          licenseActions: 0,
          status: 'NOT_AVAILABLE',
          lastCheckedAt: new Date().toISOString(),
          sourceUrl: NPDB_URL,
        };
      }

      return sandboxQuery(npi);
    },
    afterSuccess: async (result) => {
      recordProvenance({
        npi,
        source: 'NPDB',
        sourceUrl: NPDB_URL,
        rawPayload: result,
      });
    },
    onFailure: ({ reason, stage, error }) => {
      if (stage === 'quarantine') {
        log('warn', 'npdb_connector: connector quarantined', { npi, reason });
        return;
      }

      log('error', 'npdb_connector: query failed', {
        npi,
        error: error?.message ?? reason,
        stage,
      });
    },
    fallback: () => ({
      npi,
      adverseActionCount: 0,
      malpracticePayments: 0,
      licenseActions: 0,
      status: 'NOT_AVAILABLE',
      lastCheckedAt: new Date().toISOString(),
      sourceUrl: NPDB_URL,
    }),
  });
}
