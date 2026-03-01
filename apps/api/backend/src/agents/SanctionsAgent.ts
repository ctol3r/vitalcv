import { log } from '../obs/logger';
import { sha256Hex } from '../utils/deterministic';
import { AgentBase } from './AgentBase';
import type { AgentResult, SanctionResult, SanctionStatus } from './types';

/**
 * Simulates querying the OIG LEIE (List of Excluded Individuals/Entities).
 *
 * Demo behavior:
 *   - Cycles through a fixed pool of demo NPIs
 *   - Simulates ~1s network latency via setTimeout
 *   - Returns CLEARED (95%) or EXCLUDED (5%) based on deterministic hash
 *
 * Production swap: Replace `simulateLeieQuery` with a real HTTP call
 * to the OIG LEIE API (https://oig.hhs.gov/exclusions/exclusions_list.asp).
 */

const DEMO_NPIS = [
  '1003000126',
  '1234567890',
  '9876543210',
  '1112223334',
  '5556667778',
];

function deriveOutcome(npi: string): SanctionStatus {
  const seed = sha256Hex(`${npi}:${new Date().toISOString().slice(0, 10)}`);
  // Last byte: 0-242 → CLEARED (~95%), 243-255 → EXCLUDED (~5%)
  const lastByte = parseInt(seed.slice(-2), 16);
  return lastByte >= 243 ? 'EXCLUDED' : 'CLEARED';
}

function simulateLeieQuery(npi: string): Promise<SanctionResult> {
  return new Promise((resolve) => {
    const delay = 800 + Math.random() * 400; // 800-1200ms
    setTimeout(() => {
      const status = deriveOutcome(npi);
      const checkedAt = new Date().toISOString();
      const receiptHash = sha256Hex(`LEIE:${npi}:${status}:${checkedAt}`);

      resolve({
        agentId: 'sanctions',
        npi,
        status,
        source: 'OIG_LEIE',
        receiptHash,
        checkedAt,
      });
    }, delay);
  });
}

export class SanctionsAgent extends AgentBase {
  private npiIndex = 0;

  constructor(intervalMs = 30_000) {
    super({ id: 'sanctions', intervalMs, enabled: true });
  }

  async execute(): Promise<AgentResult[]> {
    const npi = DEMO_NPIS[this.npiIndex % DEMO_NPIS.length];
    this.npiIndex++;

    log('debug', `SanctionsAgent checking NPI ${npi}`, {
      event: 'sanctions_check_start',
      agentId: this.id,
      npi,
    });

    const result = await simulateLeieQuery(npi);

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
