import { MockPecosProvider } from '../mockPecosProvider';

describe('MockPecosProvider', () => {
  it('returns preview-only unresolved PECOS data instead of synthetic enrollment truth', async () => {
    const provider = new MockPecosProvider();

    const result = await provider.fetchEnrollmentStatus('1558302470');

    expect(result.claimState).toBe('UNKNOWN');
    expect(result.enrolled).toBeNull();
    expect(result.rawPayload).toEqual(expect.objectContaining({
      source: 'mock-pecos-provider',
      previewOnly: true,
      unavailable: true,
      claimState: 'UNKNOWN',
    }));
  });
});
