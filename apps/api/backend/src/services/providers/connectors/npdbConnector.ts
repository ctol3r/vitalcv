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
import { recordConnectorSuccess, recordConnectorFailure } from './connectorHealthTracker';

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

  try {
    let result: NPDBQueryResult;

    if (mode === 'live') {
      log('info', 'npdb_connector: live PROACT API not yet implemented', { npi });
      result = {
        npi,
        adverseActionCount: 0,
        malpracticePayments: 0,
        licenseActions: 0,
        status: 'NOT_AVAILABLE',
        lastCheckedAt: new Date().toISOString(),
        sourceUrl: NPDB_URL,
      };
    } else {
      result = sandboxQuery(npi);
    }

    recordProvenance({
      npi,
      source: 'NPDB',
      sourceUrl: NPDB_URL,
      rawPayload: result,
    });

    recordConnectorSuccess('NPDB');
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    recordConnectorFailure('NPDB', msg);
    log('error', 'npdb_connector: query failed', { npi, error: msg });
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
}
