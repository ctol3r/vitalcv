import { log } from '../obs/logger';
import { sha256Hex } from '../utils/deterministic';
import { AgentBase } from './AgentBase';
import type { AgentResult, SanctionResult } from './types';
import { checkOIGExclusion } from '../services/providers/connectors/oigConnector';

/**
 * Monitors OIG LEIE exclusion status via real connectors.
 *
 * Cycles through a watchlist of NPIs and calls the OIG connector
 * (sandbox or live depending on env).
 */

/**
 * Every NPI here must FAIL the NPI check digit (Luhn over "80840" + the first 9
 * digits) so it cannot collide with a registrant. This agent sends each entry to
 * a live third-party registry every cycle, so a real NPI here polls an actual
 * person's exclusion status forever without their consent and stamps a receipt
 * hash asserting it.
 *
 * `1003000126` sat at the head of this list until 2026-07-27 — it is a real
 * physician. The replacement keeps the final digit (6), because the sandbox
 * connectors branch on it. The other four entries were already
 * check-digit-invalid.
 */
const NPI_WATCHLIST = [
  '1558395516',
  '1234567890',
  '9876543210',
  '1112223334',
  '5556667778',
];

export class SanctionsAgent extends AgentBase {
  private npiIndex = 0;

  constructor(intervalMs = 30_000) {
    super({ id: 'sanctions', intervalMs, enabled: true });
  }

  async execute(): Promise<AgentResult[]> {
    const npi = NPI_WATCHLIST[this.npiIndex % NPI_WATCHLIST.length];
    this.npiIndex++;

    log('debug', `SanctionsAgent checking NPI ${npi}`, {
      event: 'sanctions_check_start',
      agentId: this.id,
      npi,
    });

    const exclusionResult = await checkOIGExclusion(npi);

    const status =
      exclusionResult.verdict === 'EXCLUDED'
        ? 'EXCLUDED' as const
        : exclusionResult.verdict === 'CLEAR'
          ? 'CLEARED' as const
          : 'UNCERTAIN' as const;
    const checkedAt = exclusionResult.lastCheckedAt;
    const receiptHash = sha256Hex(`LEIE:${npi}:${status}:${checkedAt}`);

    const result: SanctionResult = {
      agentId: 'sanctions',
      npi,
      status,
      source: 'OIG_LEIE',
      receiptHash,
      checkedAt,
    };

    log('info', `SanctionsAgent result for ${npi}: ${result.status}`, {
      event: 'sanctions_check_complete',
      agentId: this.id,
      npi,
      status: result.status,
      receiptHash: result.receiptHash,
    });

    return [result];
  }
}
