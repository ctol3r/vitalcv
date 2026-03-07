/**
 * stateBoardConnector.ts — Wave 127: State Board Connector
 *
 * Stub + architecture for per-state medical board lookups.
 * Production roadmap: implement real adapters per state.
 *
 * Architecture:
 *   - Each state has a connector that implements StateBoardAdapter
 *   - Connectors are registered in the adapter registry
 *   - Fallback: return NOT_AVAILABLE for unimplemented states
 */

import { log } from '../../../obs/logger';
import { recordProvenance } from '../providerSourceProvenance';

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

interface StateBoardAdapter {
  state: string;
  lookup(npi: string, licenseNumber?: string): Promise<StateBoardResult>;
}

// ── Adapter Registry ──────────────────────────────────────────────────

const adapters = new Map<string, StateBoardAdapter>();

/**
 * California Medical Board — stub adapter
 * Production: scrape or API call to mbc.ca.gov
 */
const caAdapter: StateBoardAdapter = {
  state: 'CA',
  async lookup(npi: string): Promise<StateBoardResult> {
    log('info', 'state_board: CA lookup (stub)', { npi });
    return {
      npi,
      state: 'CA',
      licenseNumber: null,
      licenseStatus: 'NOT_AVAILABLE',
      licensee: null,
      expirationDate: null,
      boardName: 'Medical Board of California',
      lastVerifiedAt: new Date().toISOString(),
      sourceUrl: 'https://mbc.ca.gov/breeze/',
    };
  },
};

const nyAdapter: StateBoardAdapter = {
  state: 'NY',
  async lookup(npi: string): Promise<StateBoardResult> {
    log('info', 'state_board: NY lookup (stub)', { npi });
    return {
      npi,
      state: 'NY',
      licenseNumber: null,
      licenseStatus: 'NOT_AVAILABLE',
      licensee: null,
      expirationDate: null,
      boardName: 'New York State Education Department',
      lastVerifiedAt: new Date().toISOString(),
      sourceUrl: 'http://www.op.nysed.gov/opsearches.htm',
    };
  },
};

const txAdapter: StateBoardAdapter = {
  state: 'TX',
  async lookup(npi: string): Promise<StateBoardResult> {
    log('info', 'state_board: TX lookup (stub)', { npi });
    return {
      npi,
      state: 'TX',
      licenseNumber: null,
      licenseStatus: 'NOT_AVAILABLE',
      licensee: null,
      expirationDate: null,
      boardName: 'Texas Medical Board',
      lastVerifiedAt: new Date().toISOString(),
      sourceUrl: 'https://www.tmb.state.tx.us/page/look-up-a-license',
    };
  },
};

// Register adapters
[caAdapter, nyAdapter, txAdapter].forEach((a) => adapters.set(a.state, a));

// ── Public API ────────────────────────────────────────────────────────

export async function lookupStateBoard(
  npi: string,
  state: string,
  licenseNumber?: string
): Promise<StateBoardResult> {
  const adapter = adapters.get(state.toUpperCase());

  if (!adapter) {
    return {
      npi,
      state: state.toUpperCase(),
      licenseNumber: licenseNumber ?? null,
      licenseStatus: 'NOT_AVAILABLE',
      licensee: null,
      expirationDate: null,
      boardName: `${state} Medical Board (no adapter)`,
      lastVerifiedAt: new Date().toISOString(),
      sourceUrl: '',
    };
  }

  const result = await adapter.lookup(npi, licenseNumber);

  recordProvenance({
    npi,
    source: 'STATE_BOARD',
    sourceUrl: result.sourceUrl,
    rawPayload: result,
    transformations: [{ step: 'STATE_BOARD_LOOKUP', description: `${state} board lookup`, appliedAt: new Date().toISOString() }],
  });

  return result;
}

export function listAvailableStates(): string[] {
  return [...adapters.keys()];
}
