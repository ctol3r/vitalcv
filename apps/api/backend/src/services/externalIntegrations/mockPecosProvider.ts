/**
 * Mock PECOS Provider — Wave X
 *
 * Deterministic preview-only stub for development and testing.
 *
 * This provider must never manufacture decision-grade PECOS truth from an NPI
 * pattern. It therefore returns UNKNOWN and marks the source unavailable so
 * downstream readiness logic fails closed instead of silently upgrading a mock.
 */

import type { PecosCheck, PecosProvider } from './types';

export class MockPecosProvider implements PecosProvider {
  async fetchEnrollmentStatus(npi: string): Promise<PecosCheck> {
    const normalized = npi.trim();
    if (!normalized) {
      throw new Error('npi is required for PECOS check.');
    }

    const now = new Date();
    const quarter = Math.floor(now.getUTCMonth() / 3) + 1;
    const dataVersion = `${now.getUTCFullYear()}-Q${quarter}`;

    return {
      npi: normalized,
      enrolled: null,
      claimState: 'UNKNOWN',
      enrollmentType: null,
      observedAt: now,
      dataVersion,
      dataFreshness: 'QUARTERLY',
      sourceLatency: 'QUARTERLY',
      checkedAt: now,
      rawPayload: {
        source: 'mock-pecos-provider',
        unavailable: true,
        previewOnly: true,
        method: 'preview-stub',
        checkedAt: now.toISOString(),
        observedAt: now.toISOString(),
        claimState: 'UNKNOWN',
        dataVersion,
        dataFreshness: 'QUARTERLY',
        sourceLatency: 'QUARTERLY',
        reason: 'Mock PECOS provider is preview-only and must not be treated as decision-grade enrollment truth.',
      },
    };
  }
}
