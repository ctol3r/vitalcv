import { log } from '../obs/logger';
import { AgentBase } from './AgentBase';
import type { AgentResult, LicenseStatus, StateBoardResult } from './types';
import { lookupStateBoard } from '../services/providers/connectors/stateBoardConnector';
import type { StateBoardResult as ConnectorResult } from '../services/providers/connectors/stateBoardConnector';

/**
 * Monitors state medical board license status via real connectors.
 *
 * Cycles through a watchlist of NPI/state pairs and calls the
 * State Board connector (sandbox or live depending on env).
 */

/**
 * Every NPI here must FAIL the NPI check digit (Luhn over "80840" + the first 9
 * digits) so it cannot collide with a registrant. This agent sends each entry to
 * a live state medical board every cycle, so a real NPI here polls an actual
 * person's licence status forever without their consent.
 *
 * `1003000126` sat at the head of this list until 2026-07-27 — it is a real
 * physician. The replacement keeps the final digit (6), because the sandbox
 * connectors branch on it. The other four entries were already
 * check-digit-invalid.
 */
const NPI_WATCHLIST: Array<{ npi: string; state: string }> = [
  { npi: '1558395516', state: 'CA' },
  { npi: '1234567890', state: 'NY' },
  { npi: '9876543210', state: 'TX' },
  { npi: '1112223334', state: 'FL' },
  { npi: '5556667778', state: 'IL' },
];

function mapLicenseStatus(connectorStatus: ConnectorResult['licenseStatus']): LicenseStatus {
  switch (connectorStatus) {
    case 'ACTIVE': return 'ACTIVE';
    case 'EXPIRED': return 'EXPIRED';
    case 'REVOKED': return 'REVOKED';
    case 'SUSPENDED': return 'SUSPENDED';
    case 'INACTIVE':
    case 'NOT_FOUND':
    case 'NOT_AVAILABLE':
    default:
      return 'NOT_FOUND';
  }
}

export class StateBoardAgent extends AgentBase {
  private watchlistIndex = 0;

  constructor(intervalMs = 45_000) {
    super({ id: 'state_board', intervalMs, enabled: true });
  }

  async execute(): Promise<AgentResult[]> {
    const entry = NPI_WATCHLIST[this.watchlistIndex % NPI_WATCHLIST.length];
    this.watchlistIndex++;

    log('debug', `StateBoardAgent checking ${entry.state} for NPI ${entry.npi}`, {
      event: 'board_check_start',
      agentId: this.id,
      npi: entry.npi,
      state: entry.state,
    });

    const connectorResult = await lookupStateBoard(entry.npi, entry.state);

    const result: StateBoardResult = {
      agentId: 'state_board',
      npi: connectorResult.npi,
      licenseNumber: connectorResult.licenseNumber ?? 'UNKNOWN',
      status: mapLicenseStatus(connectorResult.licenseStatus),
      boardName: connectorResult.boardName,
      state: connectorResult.state,
      expiresAt: connectorResult.expirationDate ?? '',
      checkedAt: connectorResult.lastVerifiedAt,
    };

    log('info', `StateBoardAgent result for ${entry.npi}: ${result.status}`, {
      event: 'board_check_complete',
      agentId: this.id,
      npi: entry.npi,
      status: result.status,
      state: result.state,
      boardName: result.boardName,
    });

    return [result];
  }
}
