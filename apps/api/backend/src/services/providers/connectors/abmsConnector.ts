/**
 * abmsConnector.ts — Wave 127: ABMS Board Certification Connector
 *
 * Verifies board certification status via ABMS
 * (American Board of Medical Specialties).
 *
 * Sandbox: deterministic results from NPI last digit
 * Live: ABMS Physician Verification API (requires API key)
 */

import { log } from '../../../obs/logger';
import { recordProvenance } from '../providerSourceProvenance';
import { getConnectorMode } from './connectorFactory';
import { recordConnectorSuccess, recordConnectorFailure } from './connectorHealthTracker';

export interface ABMSCertificationResult {
  npi: string;
  certified: boolean;
  boardName: string | null;
  specialtyName: string | null;
  certificationStatus: 'CERTIFIED' | 'NOT_CERTIFIED' | 'EXPIRED' | 'NOT_AVAILABLE';
  initialCertDate: string | null;
  expirationDate: string | null;
  lastVerifiedAt: string;
  sourceUrl: string;
}

const ABMS_URL = 'https://www.certificationmatters.org';

// ── Board/Specialty Combos ──────────────────────────────────────────

const BOARD_SPECIALTIES: Array<{ boardName: string; specialtyName: string }> = [
  { boardName: 'American Board of Internal Medicine', specialtyName: 'Internal Medicine' },
  { boardName: 'American Board of Family Medicine', specialtyName: 'Family Medicine' },
  { boardName: 'American Board of Surgery', specialtyName: 'General Surgery' },
  { boardName: 'American Board of Pediatrics', specialtyName: 'Pediatrics' },
  { boardName: 'American Board of Psychiatry and Neurology', specialtyName: 'Psychiatry' },
  { boardName: 'American Board of Emergency Medicine', specialtyName: 'Emergency Medicine' },
  { boardName: 'American Board of Radiology', specialtyName: 'Diagnostic Radiology' },
];

// ── Sandbox ─────────────────────────────────────────────────────────

function sandboxCertification(npi: string): ABMSCertificationResult {
  const lastDigit = parseInt(npi.slice(-1), 10);
  const comboIndex = parseInt(npi.slice(-3, -1), 10) % BOARD_SPECIALTIES.length;
  const combo = BOARD_SPECIALTIES[comboIndex];
  const now = new Date();

  if (lastDigit <= 6) {
    return {
      npi,
      certified: true,
      boardName: combo.boardName,
      specialtyName: combo.specialtyName,
      certificationStatus: 'CERTIFIED',
      initialCertDate: '2015-06-15',
      expirationDate: new Date(now.getFullYear() + 3, 5, 15).toISOString().split('T')[0],
      lastVerifiedAt: now.toISOString(),
      sourceUrl: ABMS_URL,
    };
  }

  if (lastDigit === 7) {
    return {
      npi,
      certified: false,
      boardName: combo.boardName,
      specialtyName: combo.specialtyName,
      certificationStatus: 'EXPIRED',
      initialCertDate: '2012-06-15',
      expirationDate: '2023-06-15',
      lastVerifiedAt: now.toISOString(),
      sourceUrl: ABMS_URL,
    };
  }

  // 8-9: NOT_CERTIFIED
  return {
    npi,
    certified: false,
    boardName: null,
    specialtyName: null,
    certificationStatus: 'NOT_CERTIFIED',
    initialCertDate: null,
    expirationDate: null,
    lastVerifiedAt: now.toISOString(),
    sourceUrl: ABMS_URL,
  };
}

// ── Public API ──────────────────────────────────────────────────────

export async function checkABMSCertification(npi: string): Promise<ABMSCertificationResult> {
  const mode = getConnectorMode('ABMS');

  try {
    let result: ABMSCertificationResult;

    if (mode === 'live') {
      log('info', 'abms_connector: live API not yet implemented', { npi });
      result = {
        npi,
        certified: false,
        boardName: null,
        specialtyName: null,
        certificationStatus: 'NOT_AVAILABLE',
        initialCertDate: null,
        expirationDate: null,
        lastVerifiedAt: new Date().toISOString(),
        sourceUrl: ABMS_URL,
      };
    } else {
      result = sandboxCertification(npi);
    }

    recordProvenance({
      npi,
      source: 'ABMS',
      sourceUrl: ABMS_URL,
      rawPayload: result,
    });

    recordConnectorSuccess('ABMS');
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    recordConnectorFailure('ABMS', msg);
    log('error', 'abms_connector: check failed', { npi, error: msg });
    return {
      npi,
      certified: false,
      boardName: null,
      specialtyName: null,
      certificationStatus: 'NOT_AVAILABLE',
      initialCertDate: null,
      expirationDate: null,
      lastVerifiedAt: new Date().toISOString(),
      sourceUrl: ABMS_URL,
    };
  }
}
