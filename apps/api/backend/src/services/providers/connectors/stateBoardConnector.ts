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
import { runConnectorWithReliability } from './connectorReliability';

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
  sourceMode?: 'live' | 'sandbox';
  decisionGrade?: boolean;
  degradationReason?: 'OUTAGE' | 'ACCESS_REQUIRED' | 'STALE' | 'PARSER_FAILURE' | 'NOT_IMPLEMENTED' | null;
  sourceDisclaimer?: string | null;
}

interface StateBoardAdapterConfig {
  state: string;
  boardName: string;
  sourceUrl: string;
  liveLookup?: (npi: string, licenseNumber?: string) => Promise<StateBoardResult>;
}

const STATE_BOARD_QUOTA_POLICY = {
  limit: 30,
  windowMs: 60_000,
};

const STATE_BOARD_SCHEMA_POLICY = {
  requiredFields: ['npi', 'state', 'licenseStatus', 'boardName', 'lastVerifiedAt', 'sourceUrl'],
  allowAdditionalFields: true,
} as const;

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
  const shared = {
    sourceMode: 'sandbox' as const,
    decisionGrade: false,
    degradationReason: null,
    sourceDisclaimer: 'Sandbox-only simulated state-board result. Manual or live board verification is still required.',
  };

  if (lastDigit <= 6) {
    return {
      npi, state, licenseNumber: licNum, licenseStatus: 'ACTIVE',
      licensee: `Provider ${hash.slice(0, 6).toUpperCase()}`,
      expirationDate: futureDate, boardName: config.boardName,
      lastVerifiedAt: now.toISOString(), sourceUrl: config.sourceUrl,
      ...shared,
    };
  }
  if (lastDigit === 7) {
    return {
      npi, state, licenseNumber: licNum, licenseStatus: 'EXPIRED',
      licensee: `Provider ${hash.slice(0, 6).toUpperCase()}`,
      expirationDate: pastDate, boardName: config.boardName,
      lastVerifiedAt: now.toISOString(), sourceUrl: config.sourceUrl,
      ...shared,
    };
  }
  if (lastDigit === 8) {
    return {
      npi, state, licenseNumber: licNum, licenseStatus: 'SUSPENDED',
      licensee: `Provider ${hash.slice(0, 6).toUpperCase()}`,
      expirationDate: null, boardName: config.boardName,
      lastVerifiedAt: now.toISOString(), sourceUrl: config.sourceUrl,
      ...shared,
    };
  }
  // lastDigit === 9
  return {
    npi, state, licenseNumber: licNum, licenseStatus: 'REVOKED',
    licensee: `Provider ${hash.slice(0, 6).toUpperCase()}`,
    expirationDate: null, boardName: config.boardName,
    lastVerifiedAt: now.toISOString(), sourceUrl: config.sourceUrl,
    ...shared,
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
      sourceMode: mode === 'live' ? 'live' : 'sandbox',
      decisionGrade: false,
      degradationReason: 'NOT_IMPLEMENTED',
      sourceDisclaimer: 'No supported state-board adapter is configured for this jurisdiction.',
    };
  }

  return runConnectorWithReliability({
    connector: 'STATE_BOARD',
    quotaPolicy: STATE_BOARD_QUOTA_POLICY,
    schemaPolicy: STATE_BOARD_SCHEMA_POLICY,
    execute: async () => {
      if (mode === 'live' && config.liveLookup) {
        return {
          ...(await config.liveLookup(npi, licenseNumber)),
          sourceMode: 'live',
          decisionGrade: true,
          degradationReason: null,
        };
      }

      if (mode === 'live') {
        log('info', 'state_board: live adapter not yet implemented', { npi, state: upperState });
        return {
          npi, state: upperState, licenseNumber: licenseNumber ?? null,
          licenseStatus: 'NOT_AVAILABLE', licensee: null, expirationDate: null,
          boardName: config.boardName,
          lastVerifiedAt: new Date().toISOString(), sourceUrl: config.sourceUrl,
          sourceMode: 'live',
          decisionGrade: false,
          degradationReason: 'ACCESS_REQUIRED',
          sourceDisclaimer: 'Live state-board access is not configured for this launch lane.',
        };
      }

      return sandboxLookup(npi, upperState, config);
    },
    afterSuccess: async (result) => {
      recordProvenance({
        npi,
        source: 'STATE_BOARD',
        sourceUrl: result.sourceUrl,
        rawPayload: result,
        transformations: [{ step: 'STATE_BOARD_LOOKUP', description: `${upperState} board lookup`, appliedAt: new Date().toISOString() }],
      });
    },
    onFailure: ({ reason, stage, error }) => {
      if (stage === 'quarantine') {
        log('warn', 'state_board: connector quarantined', { npi, state: upperState, reason });
        return;
      }

      log('error', 'state_board: lookup failed', {
        npi,
        state: upperState,
        error: error?.message ?? reason,
        stage,
      });
    },
    fallback: () => ({
      npi, state: upperState, licenseNumber: licenseNumber ?? null,
      licenseStatus: 'NOT_AVAILABLE', licensee: null, expirationDate: null,
      boardName: config.boardName,
      lastVerifiedAt: new Date().toISOString(), sourceUrl: config.sourceUrl,
      sourceMode: mode === 'live' ? 'live' : 'sandbox',
      decisionGrade: false,
      degradationReason: mode === 'live' ? 'OUTAGE' : 'NOT_IMPLEMENTED',
      sourceDisclaimer: mode === 'live'
        ? 'State-board verification failed or timed out. Manual verification required.'
        : 'Sandbox-only simulated state-board result. Manual or live board verification is still required.',
    }),
  });
}

export function listAvailableStates(): string[] {
  return Object.keys(STATE_CONFIGS);
}
