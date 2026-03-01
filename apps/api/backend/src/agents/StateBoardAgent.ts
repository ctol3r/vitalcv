import { log } from '../obs/logger';
import { AgentBase } from './AgentBase';
import type { AgentResult, LicenseStatus, StateBoardResult } from './types';

/**
 * Simulates state medical board license verification.
 *
 * Demo behavior:
 *   - Cycles through a pool of demo NPI/license combos
 *   - Simulates 500-1500ms latency
 *   - Returns realistic license status payloads
 *
 * Production swap: Replace `simulateBoardQuery` with real API calls
 * to state-specific board APIs (e.g., CA MBC, NY OPMC, TX TMB).
 */

type DemoLicense = {
  npi: string;
  licenseNumber: string;
  state: string;
  boardName: string;
  status: LicenseStatus;
  expiresAt: string;
};

const DEMO_LICENSES: DemoLicense[] = [
  {
    npi: '1003000126',
    licenseNumber: 'A-123456',
    state: 'CA',
    boardName: 'Medical Board of California',
    status: 'ACTIVE',
    expiresAt: '2026-12-31',
  },
  {
    npi: '1234567890',
    licenseNumber: 'MD-789012',
    state: 'NY',
    boardName: 'NY Office of the Professions',
    status: 'ACTIVE',
    expiresAt: '2026-06-30',
  },
  {
    npi: '9876543210',
    licenseNumber: 'TX-345678',
    state: 'TX',
    boardName: 'Texas Medical Board',
    status: 'EXPIRED',
    expiresAt: '2025-01-15',
  },
  {
    npi: '1112223334',
    licenseNumber: 'FL-901234',
    state: 'FL',
    boardName: 'Florida Board of Medicine',
    status: 'SUSPENDED',
    expiresAt: '2026-09-01',
  },
  {
    npi: '5556667778',
    licenseNumber: 'IL-567890',
    state: 'IL',
    boardName: 'Illinois DFPR',
    status: 'ACTIVE',
    expiresAt: '2027-03-31',
  },
];

function simulateBoardQuery(license: DemoLicense): Promise<StateBoardResult> {
  return new Promise((resolve) => {
    const delay = 500 + Math.random() * 1000; // 500-1500ms
    setTimeout(() => {
      resolve({
        agentId: 'state_board',
        npi: license.npi,
        licenseNumber: license.licenseNumber,
        status: license.status,
        boardName: license.boardName,
        state: license.state,
        expiresAt: license.expiresAt,
        checkedAt: new Date().toISOString(),
      });
    }, delay);
  });
}

export class StateBoardAgent extends AgentBase {
  private licenseIndex = 0;

  constructor(intervalMs = 45_000) {
    super({ id: 'state_board', intervalMs, enabled: true });
  }

  async execute(): Promise<AgentResult[]> {
    const license = DEMO_LICENSES[this.licenseIndex % DEMO_LICENSES.length];
    this.licenseIndex++;

    log('debug', `StateBoardAgent checking ${license.state} license ${license.licenseNumber}`, {
      event: 'board_check_start',
      agentId: this.id,
      npi: license.npi,
      state: license.state,
    });

    const result = await simulateBoardQuery(license);

    log('info', `StateBoardAgent result for ${license.npi}: ${result.status}`, {
      event: 'board_check_complete',
      agentId: this.id,
      npi: license.npi,
      status: result.status,
      state: result.state,
      boardName: result.boardName,
    });

    return [result];
  }
}
