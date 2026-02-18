/**
 * Mock PECOS Provider — Wave X
 *
 * Deterministic mock for development and testing.
 * Mirrors the existing pecosEngine.ts NPI-prefix logic:
 *   - NPI starting with "1": enrolled
 *   - All others: not enrolled
 */

import type { PecosCheck, PecosProvider } from './types';

export class MockPecosProvider implements PecosProvider {
  async fetchEnrollmentStatus(npi: string): Promise<PecosCheck> {
    const normalized = npi.trim();
    if (!normalized) {
      throw new Error('npi is required for PECOS check.');
    }

    const enrolled = normalized.startsWith('1');
    const now = new Date();

    return {
      npi: normalized,
      enrolled,
      enrollmentType: enrolled ? 'simulated-prefix-1' : null,
      checkedAt: now,
      rawPayload: {
        source: 'mock-pecos-provider',
        method: 'npi-prefix-check',
        checkedAt: now.toISOString(),
      },
    };
  }
}
