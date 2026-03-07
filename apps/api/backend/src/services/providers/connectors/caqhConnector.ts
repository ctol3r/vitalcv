/**
 * caqhConnector.ts — Wave 127: CAQH ProView Connector (Scaffold)
 *
 * Checks CAQH ProView credentialing profile status.
 *
 * Sandbox: deterministic results derived from NPI
 * Live: CAQH ProView API (integration TBD — requires org credentials)
 */

import { log } from '../../../obs/logger';
import { recordProvenance } from '../providerSourceProvenance';
import { getConnectorMode } from './connectorFactory';
import { recordConnectorSuccess, recordConnectorFailure } from './connectorHealthTracker';

export interface CAQHProfileResult {
  npi: string;
  caqhProviderId: string | null;
  profileStatus: 'COMPLETE' | 'INCOMPLETE' | 'EXPIRED' | 'NOT_FOUND' | 'NOT_AVAILABLE';
  attestationDate: string | null;
  reattestationDueDate: string | null;
  lastVerifiedAt: string;
  sourceUrl: string;
}

const CAQH_URL = 'https://proview.caqh.org';

// ── Sandbox ─────────────────────────────────────────────────────────

function sandboxProfile(npi: string): CAQHProfileResult {
  const lastDigit = parseInt(npi.slice(-1), 10);
  const caqhId = `CAQH-${npi.slice(0, 8)}`;

  if (lastDigit <= 5) {
    return {
      npi,
      caqhProviderId: caqhId,
      profileStatus: 'COMPLETE',
      attestationDate: '2025-09-01',
      reattestationDueDate: '2026-09-01',
      lastVerifiedAt: new Date().toISOString(),
      sourceUrl: CAQH_URL,
    };
  }

  if (lastDigit <= 7) {
    return {
      npi,
      caqhProviderId: caqhId,
      profileStatus: 'INCOMPLETE',
      attestationDate: null,
      reattestationDueDate: null,
      lastVerifiedAt: new Date().toISOString(),
      sourceUrl: CAQH_URL,
    };
  }

  if (lastDigit === 8) {
    return {
      npi,
      caqhProviderId: caqhId,
      profileStatus: 'EXPIRED',
      attestationDate: '2023-03-15',
      reattestationDueDate: '2024-03-15',
      lastVerifiedAt: new Date().toISOString(),
      sourceUrl: CAQH_URL,
    };
  }

  return {
    npi,
    caqhProviderId: null,
    profileStatus: 'NOT_FOUND',
    attestationDate: null,
    reattestationDueDate: null,
    lastVerifiedAt: new Date().toISOString(),
    sourceUrl: CAQH_URL,
  };
}

// ── Public API ──────────────────────────────────────────────────────

export async function checkCAQHProfile(npi: string): Promise<CAQHProfileResult> {
  const mode = getConnectorMode('CAQH');

  try {
    let result: CAQHProfileResult;

    if (mode === 'live') {
      log('info', 'caqh_connector: live API not yet implemented', { npi });
      result = {
        npi,
        caqhProviderId: null,
        profileStatus: 'NOT_AVAILABLE',
        attestationDate: null,
        reattestationDueDate: null,
        lastVerifiedAt: new Date().toISOString(),
        sourceUrl: CAQH_URL,
      };
    } else {
      result = sandboxProfile(npi);
    }

    recordProvenance({
      npi,
      source: 'CAQH',
      sourceUrl: CAQH_URL,
      rawPayload: result,
    });

    recordConnectorSuccess('CAQH');
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    recordConnectorFailure('CAQH', msg);
    log('error', 'caqh_connector: check failed', { npi, error: msg });
    return {
      npi,
      caqhProviderId: null,
      profileStatus: 'NOT_AVAILABLE',
      attestationDate: null,
      reattestationDueDate: null,
      lastVerifiedAt: new Date().toISOString(),
      sourceUrl: CAQH_URL,
    };
  }
}
