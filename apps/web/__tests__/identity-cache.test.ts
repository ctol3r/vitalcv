// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearIdentity,
  readIdentity,
  writeIdentity,
  type CachedIdentity,
} from '../lib/hybrid-loader/identityCache';
import type { StreamIdentity } from '../hooks/ingestStreamState';

const TEST_KEY = '1234567890';
const TTL_MS = 24 * 60 * 60 * 1000;

function buildIdentity(overrides: Partial<StreamIdentity> = {}): StreamIdentity {
  return {
    entityId: 'entity-1',
    displayName: 'Jane Doe',
    specialty: 'Internal Medicine',
    entityType: 'PERSON',
    status: 'VERIFIED',
    authoritative: true,
    ...overrides,
  };
}

describe('identityCache', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  describe('readIdentity', () => {
    it('returns null when no entry exists', () => {
      expect(readIdentity(TEST_KEY)).toBeNull();
    });

    it('returns null when the entry is malformed JSON', () => {
      window.localStorage.setItem('vcv:identity:v1:' + TEST_KEY, '{not json');
      expect(readIdentity(TEST_KEY)).toBeNull();
    });

    it('returns null when the schema version does not match', () => {
      const entry = {
        v: 99,
        savedAt: Date.now(),
        key: TEST_KEY,
        identity: buildIdentity(),
      };
      window.localStorage.setItem('vcv:identity:v1:' + TEST_KEY, JSON.stringify(entry));
      expect(readIdentity(TEST_KEY)).toBeNull();
    });

    it('returns null when the entry has expired the 24h TTL', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-10T12:00:00Z'));
      writeIdentity(TEST_KEY, { identity: buildIdentity() });

      // Advance past the 24h TTL
      vi.setSystemTime(new Date('2026-04-10T12:00:00Z').getTime() + TTL_MS + 1);
      expect(readIdentity(TEST_KEY)).toBeNull();
    });

    it('returns the cached entry when savedAt is fresh', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-10T12:00:00Z'));

      writeIdentity(TEST_KEY, { identity: buildIdentity() });

      // Just under the TTL
      vi.setSystemTime(new Date('2026-04-10T12:00:00Z').getTime() + TTL_MS - 1);

      const result = readIdentity(TEST_KEY);
      expect(result).not.toBeNull();
      expect(result?.identity.displayName).toBe('Jane Doe');
      expect(result?.v).toBe(1);
    });

    it('returns null when savedAt is not a number', () => {
      const entry = {
        v: 1,
        savedAt: 'nope',
        key: TEST_KEY,
        identity: buildIdentity(),
      } as unknown as CachedIdentity;
      window.localStorage.setItem('vcv:identity:v1:' + TEST_KEY, JSON.stringify(entry));
      expect(readIdentity(TEST_KEY)).toBeNull();
    });
  });

  describe('writeIdentity', () => {
    it('round-trips identity + standing + readiness', () => {
      writeIdentity(TEST_KEY, {
        identity: buildIdentity(),
        standing: {
          exclusionChecked: true,
          exclusionClear: true,
          exclusionStatus: 'CLEAR',
          enrollmentChecked: true,
          enrollmentStatus: 'ENROLLED',
        },
        readiness: {
          score: 87,
          level: 'L3',
          status: 'READY',
        },
      });

      const result = readIdentity(TEST_KEY);
      expect(result?.identity.displayName).toBe('Jane Doe');
      expect(result?.standing?.exclusionStatus).toBe('CLEAR');
      expect(result?.readiness?.score).toBe(87);
      expect(result?.readiness?.level).toBe('L3');
    });

    it('preserves previously-cached standing when the next write is identity-only', () => {
      writeIdentity(TEST_KEY, {
        identity: buildIdentity(),
        standing: {
          exclusionChecked: true,
          exclusionClear: true,
          exclusionStatus: 'CLEAR',
          enrollmentChecked: false,
        },
      });

      // Identity-only update (e.g. a freshness re-fetch that only touched
      // NPPES). Standing should carry forward from the earlier write.
      writeIdentity(TEST_KEY, {
        identity: buildIdentity({ displayName: 'Jane Updated' }),
      });

      const result = readIdentity(TEST_KEY);
      expect(result?.identity.displayName).toBe('Jane Updated');
      expect(result?.standing?.exclusionStatus).toBe('CLEAR');
      expect(result?.standing?.exclusionClear).toBe(true);
    });

    it('refreshes savedAt on every write so the TTL rolls forward', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-10T00:00:00Z'));
      writeIdentity(TEST_KEY, { identity: buildIdentity() });
      const first = readIdentity(TEST_KEY)?.savedAt;

      vi.setSystemTime(new Date('2026-04-10T06:00:00Z'));
      writeIdentity(TEST_KEY, { identity: buildIdentity({ displayName: 'Jane Two' }) });
      const second = readIdentity(TEST_KEY)?.savedAt;

      expect(second).toBeDefined();
      expect(second).toBeGreaterThan(first ?? 0);
    });

    it('is a no-op when localStorage.setItem throws', () => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = () => {
        throw new Error('QuotaExceededError');
      };

      try {
        expect(() => writeIdentity(TEST_KEY, { identity: buildIdentity() })).not.toThrow();
      } finally {
        Storage.prototype.setItem = original;
      }
    });
  });

  describe('clearIdentity', () => {
    it('removes a previously-written entry', () => {
      writeIdentity(TEST_KEY, { identity: buildIdentity() });
      expect(readIdentity(TEST_KEY)).not.toBeNull();

      clearIdentity(TEST_KEY);
      expect(readIdentity(TEST_KEY)).toBeNull();
    });

    it('is a no-op when the entry does not exist', () => {
      expect(() => clearIdentity('nonexistent-key')).not.toThrow();
    });
  });
});
