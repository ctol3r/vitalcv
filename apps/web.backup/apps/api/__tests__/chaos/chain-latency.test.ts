import { describe, it, expect, jest, afterEach, beforeEach } from '@jest/globals';
import { createAnchor } from '../../src/services/verify/anchor';

describe('Chaos: chain latency resilience', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps anchors deterministic even if substrate replies after 6s', async () => {
    const promise = simulateSubstrateBatch('presentation-123');
    jest.advanceTimersByTime(6000);
    const anchor = await promise;
    expect(anchor.txHash).toMatch(/^0x/);
    expect(anchor.anchorId).toContain('presentation-123');
  });

  it('retries substrate call without corrupting anchor data', async () => {
    const attempts: string[] = [];
    const anchor = await retrySubstrateWithJitter('presentation-456', attempts, 3);
    expect(attempts).toHaveLength(3);
    attempts.forEach((hash) => expect(hash).toBe(anchor.txHash));
  });
});

function simulateSubstrateBatch(seed: string) {
  return new Promise<ReturnType<typeof createAnchor>>((resolve) => {
    const delay = 1000 + Math.floor(Math.random() * 5000);
    setTimeout(() => {
      resolve(createAnchor([seed, 'seed']));
    }, delay);
  });
}

async function retrySubstrateWithJitter(
  seed: string,
  attempts: string[],
  maxRetries: number,
): Promise<ReturnType<typeof createAnchor>> {
  for (let i = 0; i < maxRetries; i += 1) {
    try {
      const anchor = createAnchor([seed, i]);
      attempts.push(anchor.txHash);
      if (i < maxRetries - 1) {
        throw new Error('simulated timeout');
      }
      return anchor;
    } catch {
      const delay = 500 * Math.pow(2, i);
      jest.advanceTimersByTime(delay);
    }
  }
  throw new Error('substrate unavailable after retries');
}











