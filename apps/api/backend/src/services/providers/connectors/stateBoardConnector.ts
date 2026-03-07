/**
 * stateBoardConnector.ts — Wave 127: State Board Connector
 *
 * Per-state medical board license lookups with sandbox/live mode.
 *
 * Sandbox: deterministic results derived from NPI last digit
 * Live: HTTP calls to state-specific board APIs (per adapter)
 */

import { createHash } from 'node:crypto';
import { log } from '../../../obs/logger';
import { recordProvenance } from '../providerSourceProvenance';
import { getConnectorMode } from './connectorFactory';
import { recordConnectorSuccess, recordConnectorFailure } from './connectorHealthTracker';

export interface StateBoardResult {
  npi: string;
  state: string;
  licenseNumber: string | null;
  licenseStatus: 'ACTIVE' | 'INACTIVE' | 'REVOKED' | 'EXPIRED' | 'SUSPENDED' | 'NOT_FOUND' | 'NOT_AVAILABLE';
  licensee: string | null;
  expirationDate: string | null;
  boardName: string;
  lastVerifiedAt: string;
  sourceUrl: string;
}

interface StateBoardAdapterConfig {
  state: string;
  boardName: string;
  sourceUrl: string;
  liveLookup?: (npi: string, licenseNumber?: string) => Promise<StateBoardResult>;
}

// ── State Board Configs ─────────────────────────────────────────────

const STATE_CONFIGS: Record<string, StateBoardAdapterConfig> = {
  CA: { state: 'CA', boardName: 'Medical Board of California', sourceUrl: 'https://mbc.ca.gov/breeze/' },
  NY: { state: 'NY', boardName: 'New York State Education Department', sourceUrl: 'http://www.op.nysed.gov/opsearches.htm' },
  TX: { state: 'TX', boardName: 'Texas Medical Board', sourceUrl: 'https://www.tmb.state.tx.us/page/look-up-a-license' },
  FL: { state: 'FL', boardName: 'Florida Department of Health', sourceUrl: 'https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders' },
  IL: { state: 'IL', boardName: 'Illinois DFPR', sourceUrl: 'https://online-dfpr.micropact.com/lookup/licenselookup.aspx' },
};

// ── Sandbox ─────────────────────────────────────────────────────────

function sandboxLookup(npi: string, state: string, config: StateBoardAdapterConfig): StateBoardResult {
  const lastDigit = parseInt(npi.slice(-1), 10);
  const hash = createHash('sha256').update(`sb:${npi}:${state}`).digest('hex');
  const licNum = `${state}-MD-${npi.slice(2, 8)}`;

  const now = new Date();
  const futureDate = new Date(now.getFullYear() + 2, now.getMonth(), 1).toISOString().split('T')[0];
  const pastDate = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().split('T')[0];

  if (lastDigit <= 6) {
    return {
      npi, state, licenseNumber: licNum, licenseStatus: 'ACTIVE',
      licensee: `Provider ${hash.slice(0, 6).toUpperCase()}`,
      expirationDate: futureDate, boardName: config.boardName,
      lastVerifiedAt: now.toISOString(), sourceUrl: config.sourceUrl,
    };
  }
  if (lastDigit === 7) {
    return {
      npi, state, licenseNumber: licNum, licenseStatus: 'EXPIRED',
      licensee: `Provider ${hash.slice(0, 6).toUpperCase()}`,
      expirationDate: pastDate, boardName: config.boardName,
      lastVerifiedAt: now.toISOString(), sourceUrl: config.sourceUrl,
    };
  }
  if (lastDigit === 8) {
    return {
      npi, state, licenseNumber: licNum, licenseStatus: 'SUSPENDED',
      licensee: `Provider ${hash.slice(0, 6).toUpperCase()}`,
      expirationDate: null, boardName: config.boardName,
      lastVerifiedAt: now.toISOString(), sourceUrl: config.sourceUrl,
    };
  }
  // lastDigit === 9
  return {
    npi, state, licenseNumber: licNum, licenseStatus: 'REVOKED',
    licensee: `Provider ${hash.slice(0, 6).toUpperCase()}`,
    expirationDate: null, boardName: config.boardName,
    lastVerifiedAt: now.toISOString(), sourceUrl: config.sourceUrl,
  };
}

// ── Public API ──────────────────────────────────────────────────────

export async function lookupStateBoard(
  npi: string,
  state: string,
  licenseNumber?: string
): Promise<StateBoardResult> {
  const upperState = state.toUpperCase();
  const config = STATE_CONFIGS[upperState];
  const mode = getConnectorMode('STATE_BOARD');

  if (!config) {
    return {
      npi, state: upperState, licenseNumber: licenseNumber ?? null,
      licenseStatus: 'NOT_AVAILABLE', licensee: null, expirationDate: null,
      boardName: `${upperState} Medical Board (no adapter)`,
      lastVerifiedAt: new Date().toISOString(), sourceUrl: '',
    };
  }

  try {
    let result: StateBoardResult;

    if (mode === 'live' && config.liveLookup) {
      result = await config.liveLookup(npi, licenseNumber);
    } else if (mode === 'live') {
      log('info', 'state_board: live adapter not yet implemented', { npi, state: upperState });
      result = {
        npi, state: upperState, licenseNumber: licenseNumber ?? null,
        licenseStatus: 'NOT_AVAILABLE', licensee: null, expirationDate: null,
        boardName: config.boardName,
        lastVerifiedAt: new Date().toISOString(), sourceUrl: config.sourceUrl,
      };
    } else {
      result = sandboxLookup(npi, upperState, config);
    }

    recordProvenance({
      npi,
      source: 'STATE_BOARD',
      sourceUrl: result.sourceUrl,
      rawPayload: result,
      transformations: [{ step: 'STATE_BOARD_LOOKUP', description: `${upperState} board lookup`, appliedAt: new Date().toISOString() }],
    });

    recordConnectorSuccess('STATE_BOARD');
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    recordConnectorFailure('STATE_BOARD', msg);
    log('error', 'state_board: lookup failed', { npi, state: upperState, error: msg });
    return {
      npi, state: upperState, licenseNumber: licenseNumber ?? null,
      licenseStatus: 'NOT_AVAILABLE', licensee: null, expirationDate: null,
      boardName: config.boardName,
      lastVerifiedAt: new Date().toISOString(), sourceUrl: config.sourceUrl,
    };
  }
}

export function listAvailableStates(): string[] {
  return Object.keys(STATE_CONFIGS);
}
