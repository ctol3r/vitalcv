/**
 * sourceRegistryNursysFlag.test.ts — REAL_NURSYS_ENABLED must never crash
 * callers, and must never let the deterministic stub masquerade as live.
 *
 * Old behavior: flag on → getVerificationSource('NURSYS') THREW, taking
 * down monitoring sweeps and artifact issuance the moment the flag flipped.
 * New behavior: flag on with no live adapter serves an honest
 * access-pending placeholder whose UNKNOWN status maps to needs_review.
 */

import {
  getVerificationSource,
  registerVerificationSource,
} from '../src/services/sourceRegistry';
import type {
  VerificationResult,
  VerificationSource,
} from '../src/interfaces/verificationSource';

describe('sourceRegistry NURSYS flag semantics', () => {
  const originalFlag = process.env.REAL_NURSYS_ENABLED;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.REAL_NURSYS_ENABLED;
    } else {
      process.env.REAL_NURSYS_ENABLED = originalFlag;
    }
  });

  test('flag off serves the deterministic stub (legacy behavior unchanged)', () => {
    delete process.env.REAL_NURSYS_ENABLED;

    const source = getVerificationSource('NURSYS');

    expect(source.name).toBe('NURSYS_STUB');
  });

  test('flag on without a live adapter serves the honest access-pending placeholder, not a throw', async () => {
    process.env.REAL_NURSYS_ENABLED = 'true';

    const source = getVerificationSource('NURSYS');
    expect(source.name).toBe('NURSYS_ACCESS_PENDING');

    const result = await source.verify('1234567890');
    expect(result.licenseStatus).toBe('UNKNOWN');
    expect((result.rawPayload as { unavailable?: boolean }).unavailable).toBe(true);
  });

  test('flag on with a registered live NURSYS adapter serves the live adapter', () => {
    process.env.REAL_NURSYS_ENABLED = 'true';

    const liveAdapter: VerificationSource = {
      name: 'NURSYS',
      decisionGrade: true,
      async verify(): Promise<VerificationResult> {
        return {
          licenseStatus: 'ACTIVE',
          jurisdiction: 'CA',
          lastUpdated: new Date(),
          sourceUrl: 'https://api.nursys.com',
          rawPayload: { live: true },
        };
      },
    };
    registerVerificationSource(liveAdapter);

    expect(getVerificationSource('NURSYS')).toBe(liveAdapter);
  });

  test('unknown source names still throw', () => {
    expect(() => getVerificationSource('NOT_A_SOURCE')).toThrow(/Unknown verification source/);
  });
});
