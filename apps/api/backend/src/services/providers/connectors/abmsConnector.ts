/**
 * abmsConnector.ts — Wave 127: ABMS Board Certification Connector
 *
 * Verifies board certification status via ABMS
 * (American Board of Medical Specialties).
 *
 * Production: integrate with ABMS Physician Verification API
 * or CertificationMatters.org portal.
 */

import { log } from '../../../obs/logger';
import { recordProvenance } from '../providerSourceProvenance';

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

/**
 * Check ABMS board certification for an NPI.
 * Currently a stub — returns NOT_AVAILABLE.
 */
export async function checkABMSCertification(npi: string): Promise<ABMSCertificationResult> {
  log('info', 'abms_connector: certification check (stub)', { npi });

  const result: ABMSCertificationResult = {
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

  recordProvenance({
    npi,
    source: 'ABMS',
    sourceUrl: ABMS_URL,
    rawPayload: result,
  });

  return result;
}
