/**
 * Mock Nursys Provider — Wave X
 *
 * Deterministic mock for development and testing.
 * Returns simulated license events based on NPI prefix:
 *   - NPI starting with "1": active license
 *   - NPI starting with "2": expired license
 *   - All others: no events
 */

import type { NursysEvent, NursysProvider } from './types';

export class MockNursysProvider implements NursysProvider {
  async fetchLicenseStatus(npi: string): Promise<NursysEvent[]> {
    const normalized = npi.trim();
    if (!normalized) {
      return [];
    }

    const now = new Date();

    if (normalized.startsWith('1')) {
      return [
        {
          npi: normalized,
          licenseNumber: `RN-${normalized.slice(0, 6)}`,
          state: 'CA',
          eventType: 'license-active',
          rawPayload: {
            source: 'mock-nursys-provider',
            method: 'npi-prefix-simulation',
            checkedAt: now.toISOString(),
          },
          receivedAt: now,
        },
      ];
    }

    if (normalized.startsWith('2')) {
      return [
        {
          npi: normalized,
          licenseNumber: `RN-${normalized.slice(0, 6)}`,
          state: 'NY',
          eventType: 'license-expired',
          rawPayload: {
            source: 'mock-nursys-provider',
            method: 'npi-prefix-simulation',
            checkedAt: now.toISOString(),
          },
          receivedAt: now,
        },
      ];
    }

    return [];
  }
}
