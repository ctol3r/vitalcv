/**
 * Chain Services Unit Tests
 */

import { buildCredentialHash, buildDataHash, isValidHash } from '../../src/chain/hashBuilder';
import { normalizeChainError, isConnectionError } from '../../src/chain/errorNormalizer';
import { ChainRateLimiter } from '../../src/chain/rateLimit';
import { withTimeout, chainCallWithTimeout } from '../../src/chain/timeout';

describe('Hash Builder', () => {
  it('should build deterministic credential hash', () => {
    const input = {
      id: 'cred-123',
      issuer: 'did:example:issuer',
      subject: 'did:example:subject',
      issuanceDate: '2024-01-01T00:00:00Z',
      credentialType: ['VerifiableCredential', 'TestCredential'],
    };

    const hash1 = buildCredentialHash(input);
    const hash2 = buildCredentialHash(input);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('should build data hash', () => {
    const hash = buildDataHash({ test: 'data' });
    expect(isValidHash(hash)).toBe(true);
  });

  it('should validate hash format', () => {
    expect(isValidHash('0x' + '0'.repeat(64))).toBe(true);
    expect(isValidHash('invalid')).toBe(false);
    expect(isValidHash('0x123')).toBe(false);
  });
});

describe('Error Normalizer', () => {
  it('should normalize generic errors', () => {
    const error = new Error('Test error');
    const normalized = normalizeChainError(error);

    expect(normalized.code).toBe('GENERIC_ERROR');
    expect(normalized.message).toBe('Test error');
  });

  it('should detect connection errors', () => {
    const error = new Error('Connection timeout');
    expect(isConnectionError(error)).toBe(true);

    const notConnectionError = new Error('Invalid transaction');
    expect(isConnectionError(notConnectionError)).toBe(false);
  });
});

describe('Rate Limiter', () => {
  it('should enforce rate limits', async () => {
    const limiter = new ChainRateLimiter(3, 1000);

    // First 3 calls should succeed
    expect(await limiter.checkLimit('test')).toBe(true);
    expect(await limiter.checkLimit('test')).toBe(true);
    expect(await limiter.checkLimit('test')).toBe(true);

    // 4th call should fail
    expect(await limiter.checkLimit('test')).toBe(false);

    // Reset and try again
    limiter.reset('test');
    expect(await limiter.checkLimit('test')).toBe(true);
  });

  it('should track remaining calls', async () => {
    const limiter = new ChainRateLimiter(5, 1000);

    expect(limiter.getRemainingCalls('test')).toBe(5);

    await limiter.checkLimit('test');
    expect(limiter.getRemainingCalls('test')).toBe(4);

    await limiter.checkLimit('test');
    expect(limiter.getRemainingCalls('test')).toBe(3);
  });
});

describe('Timeout Wrapper', () => {
  it('should timeout slow operations', async () => {
    const slowOp = new Promise(resolve => setTimeout(resolve, 5000));

    await expect(
      withTimeout(slowOp, 100)
    ).rejects.toThrow('timed out');
  });

  it('should not timeout fast operations', async () => {
    const fastOp = Promise.resolve('success');

    const result = await withTimeout(fastOp, 1000);
    expect(result).toBe('success');
  });

  it('should return fallback on timeout', async () => {
    const slowOp = () => new Promise(resolve => setTimeout(resolve, 5000));

    const result = await chainCallWithTimeout(slowOp, 100, 'fallback');
    expect(result).toBe('fallback');
  });
});

