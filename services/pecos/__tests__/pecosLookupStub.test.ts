import { describe, it, expect } from '@jest/globals';
import { lookupPecosSnapshot } from '../stub/pecosLookupStub.js';
import { PecosProviderStatus } from '../models/PECOSProvider.js';

describe('PECOS lookup stub', () => {
  it('returns provider metadata and documents', async () => {
    const result = await lookupPecosSnapshot({
      npi: '1234567890',
      clinicianId: 'did:example:abc',
      seed: 0.42,
    });

    expect(result.provider.npi).toBe('1234567890');
    expect(Object.values(PecosProviderStatus)).toContain(result.provider.status);
    expect(result.documents.length).toBeGreaterThan(0);
  });

  it('simulates failures when requested', async () => {
    await expect(
      lookupPecosSnapshot({
        npi: '1234567890',
        failureRate: 1,
      })
    ).rejects.toThrow('simulated upstream failure');
  });
});
