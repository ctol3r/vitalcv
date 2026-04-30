/**
 * ENTERPRISE-VANGUARD-6A — California Medical Board adapter stub.
 *
 * Truth invariants:
 *   1. This adapter is not connected to the California Medical Board.
 *   2. Methods return planned-integration stub responses only.
 *   3. No method performs network access, persistence, or credential lookup.
 */

import type { AuthorityAdapter, AuthorityAdapterCapability, AuthorityAdapterStatus } from './adapterMatrix';

const PLANNED_CAPABILITIES: AuthorityAdapterCapability[] = [
  'verify_license',
  'check_disciplinary',
  'get_expiration',
  'get_limitations',
  'check_npi_match',
];

export class CaliforniaMedicalBoardAdapter implements AuthorityAdapter {
  adapterId = 'ca-medical-board';
  authorityName = 'California Medical Board';
  state = 'CA';
  capabilities = PLANNED_CAPABILITIES;
  status: AuthorityAdapterStatus = 'stub';
  isLive = false as const;

  async checkLicenseStatus(
    _npi: string,
  ): Promise<{ found: boolean; active: boolean | null; reason: string }> {
    return {
      found: false,
      active: null,
      reason: 'CaliforniaMedicalBoard API is not connected. This is a planned integration stub.',
    };
  }

  async checkDisciplinaryActions(
    _npi: string,
  ): Promise<{ hasActions: boolean | null; reason: string }> {
    return {
      hasActions: null,
      reason: 'Disciplinary action lookup is not implemented. This is a planned integration stub.',
    };
  }

  async getExpirationDate(_npi: string): Promise<{ expiresAt: string | null; reason: string }> {
    return {
      expiresAt: null,
      reason: 'License expiration lookup is not connected. This is a planned integration stub.',
    };
  }

  async getLimitations(_npi: string): Promise<{ limitations: string[]; reason: string }> {
    return {
      limitations: [],
      reason: 'Limitations lookup is not connected. This is a planned integration stub.',
    };
  }
}

export const californiaMedicalBoardAdapter = new CaliforniaMedicalBoardAdapter();
