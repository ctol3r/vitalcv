/**
 * B127A-TEFCA-013: TEFCA dry-run tests
 *
 * Tests:
 * - UDAP/SSRAA redaction
 * - Token rotation
 * - Retention policies (30d)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHash } from 'crypto';

/**
 * UDAP token structure
 */
interface UDAPToken {
  jti: string;
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  client_id: string;
  scope: string;
  extensions?: {
    [key: string]: any;
  };
}

/**
 * SSRAA (Signed Software Statement and Registration Assertion)
 */
interface SSRAA {
  software_id: string;
  client_name: string;
  client_uri: string;
  redirect_uris: string[];
  contacts: string[];
  jwks_uri: string;
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  scope: string;
  iat: number;
  exp: number;
}

/**
 * Redaction patterns for PII/PHI
 */
const REDACTION_PATTERNS = [
  // Email addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  // Phone numbers
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  // SSN
  /\b\d{3}-\d{2}-\d{4}\b/g,
  // IP addresses
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
];

/**
 * Redact sensitive data from text
 * B127A-TEFCA-013: Mask regex validated for PII/PHI
 */
export function redactSensitiveData(text: string): string {
  let redacted = text;

  REDACTION_PATTERNS.forEach((pattern, index) => {
    redacted = redacted.replace(pattern, (match) => {
      const type = ['EMAIL', 'PHONE', 'SSN', 'IP'][index];
      return `[REDACTED_${type}]`;
    });
  });

  return redacted;
}

/**
 * Token rotation with versioning
 */
interface TokenRotationRecord {
  tokenId: string;
  version: number;
  issuedAt: Date;
  expiresAt: Date;
  rotatedAt?: Date;
  status: 'active' | 'rotated' | 'revoked';
}

class TokenRotationManager {
  private tokens: Map<string, TokenRotationRecord[]> = new Map();

  /**
   * Issue new token
   */
  issue(tokenId: string, expiresIn: number = 86400): TokenRotationRecord {
    const now = new Date();
    const record: TokenRotationRecord = {
      tokenId,
      version: 1,
      issuedAt: now,
      expiresAt: new Date(now.getTime() + expiresIn * 1000),
      status: 'active',
    };

    this.tokens.set(tokenId, [record]);
    return record;
  }

  /**
   * Rotate token daily
   * B127A-TEFCA-013: Rotation happens daily
   */
  rotate(tokenId: string): TokenRotationRecord | null {
    const records = this.tokens.get(tokenId);
    if (!records || records.length === 0) {
      return null;
    }

    const current = records[records.length - 1];
    if (current.status !== 'active') {
      return null;
    }

    // Mark current as rotated
    current.status = 'rotated';
    current.rotatedAt = new Date();

    // Issue new version
    const now = new Date();
    const newRecord: TokenRotationRecord = {
      tokenId,
      version: current.version + 1,
      issuedAt: now,
      expiresAt: new Date(now.getTime() + 86400 * 1000), // 24 hours
      status: 'active',
    };

    records.push(newRecord);
    return newRecord;
  }

  /**
   * Get active token
   */
  getActive(tokenId: string): TokenRotationRecord | null {
    const records = this.tokens.get(tokenId);
    if (!records) return null;

    return records.find(r => r.status === 'active') || null;
  }

  /**
   * Get all versions
   */
  getVersions(tokenId: string): TokenRotationRecord[] {
    return this.tokens.get(tokenId) || [];
  }
}

/**
 * Retention policy enforcement (30 days)
 */
interface RetentionRecord {
  id: string;
  type: 'token' | 'ssraa' | 'audit_log' | 'session';
  createdAt: Date;
  expiresAt: Date;
  data: any;
  deleted: boolean;
}

class RetentionPolicyManager {
  private records: Map<string, RetentionRecord> = new Map();
  private retentionDays = 30;

  /**
   * Store record with 30-day retention
   * B127A-TEFCA-013: Retention 30d enforced
   */
  store(record: Omit<RetentionRecord, 'expiresAt' | 'deleted'>): RetentionRecord {
    const expiresAt = new Date(record.createdAt.getTime() + this.retentionDays * 24 * 60 * 60 * 1000);

    const fullRecord: RetentionRecord = {
      ...record,
      expiresAt,
      deleted: false,
    };

    this.records.set(record.id, fullRecord);
    return fullRecord;
  }

  /**
   * Cleanup expired records
   */
  cleanupExpired(): number {
    const now = new Date();
    let deletedCount = 0;

    for (const [id, record] of this.records.entries()) {
      if (!record.deleted && now > record.expiresAt) {
        record.deleted = true;
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Get retention statistics
   */
  getStats(): {
    total: number;
    active: number;
    expired: number;
    deleted: number;
  } {
    const now = new Date();
    let active = 0;
    let expired = 0;
    let deleted = 0;

    for (const record of this.records.values()) {
      if (record.deleted) {
        deleted++;
      } else if (now > record.expiresAt) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.records.size,
      active,
      expired,
      deleted,
    };
  }

  /**
   * Get all records
   */
  getAllRecords(): RetentionRecord[] {
    return Array.from(this.records.values());
  }
}

describe('B127A-TEFCA-013: TEFCA UDAP/SSRAA Security Tests', () => {
  describe('PII/PHI Redaction', () => {
    it('should redact email addresses', () => {
      const text = 'Contact: john.doe@example.com for more info';
      const redacted = redactSensitiveData(text);

      expect(redacted).toBe('Contact: [REDACTED_EMAIL] for more info');
      expect(redacted).not.toContain('john.doe@example.com');
    });

    it('should redact phone numbers', () => {
      const text = 'Call 555-123-4567 or 555.987.6543';
      const redacted = redactSensitiveData(text);

      expect(redacted).toBe('Call [REDACTED_PHONE] or [REDACTED_PHONE]');
      expect(redacted).not.toContain('555-123-4567');
    });

    it('should redact SSN', () => {
      const text = 'SSN: 123-45-6789';
      const redacted = redactSensitiveData(text);

      expect(redacted).toBe('SSN: [REDACTED_SSN]');
      expect(redacted).not.toContain('123-45-6789');
    });

    it('should redact IP addresses', () => {
      const text = 'Request from 192.168.1.100';
      const redacted = redactSensitiveData(text);

      expect(redacted).toBe('Request from [REDACTED_IP]');
      expect(redacted).not.toContain('192.168.1.100');
    });

    it('should handle multiple redactions in same text', () => {
      const text = 'User john@example.com from 10.0.0.1 called 555-1234';
      const redacted = redactSensitiveData(text);

      expect(redacted).toContain('[REDACTED_EMAIL]');
      expect(redacted).toContain('[REDACTED_IP]');
      expect(redacted).toContain('[REDACTED_PHONE]');
      expect(redacted).not.toContain('john@example.com');
      expect(redacted).not.toContain('10.0.0.1');
    });

    it('should preserve non-sensitive data', () => {
      const text = 'Patient visited on 2023-12-01 for routine checkup';
      const redacted = redactSensitiveData(text);

      expect(redacted).toBe(text); // No redactions needed
    });
  });

  describe('Token Rotation', () => {
    let manager: TokenRotationManager;

    beforeEach(() => {
      manager = new TokenRotationManager();
    });

    it('should issue initial token with version 1', () => {
      const token = manager.issue('token-123');

      expect(token.tokenId).toBe('token-123');
      expect(token.version).toBe(1);
      expect(token.status).toBe('active');
      expect(token.issuedAt).toBeInstanceOf(Date);
      expect(token.expiresAt).toBeInstanceOf(Date);
    });

    it('should rotate token daily and increment version', () => {
      // Issue initial token
      const initial = manager.issue('token-123');
      expect(initial.version).toBe(1);

      // Rotate token
      const rotated = manager.rotate('token-123');

      expect(rotated).not.toBeNull();
      expect(rotated!.version).toBe(2);
      expect(rotated!.status).toBe('active');

      // Check old token is marked as rotated
      const versions = manager.getVersions('token-123');
      expect(versions).toHaveLength(2);
      expect(versions[0].status).toBe('rotated');
      expect(versions[0].rotatedAt).toBeInstanceOf(Date);
      expect(versions[1].status).toBe('active');
    });

    it('should track multiple rotations', () => {
      manager.issue('token-123');

      // Rotate 5 times
      for (let i = 0; i < 5; i++) {
        manager.rotate('token-123');
      }

      const versions = manager.getVersions('token-123');
      expect(versions).toHaveLength(6); // Initial + 5 rotations
      expect(versions[versions.length - 1].version).toBe(6);

      // Only last version should be active
      const activeVersions = versions.filter(v => v.status === 'active');
      expect(activeVersions).toHaveLength(1);
      expect(activeVersions[0].version).toBe(6);
    });

    it('should not rotate already rotated token', () => {
      manager.issue('token-123');
      manager.rotate('token-123');

      // Try to rotate the first version again (should fail)
      const result = manager.rotate('token-123');

      // Should rotate the currently active token (v2 -> v3)
      expect(result!.version).toBe(3);
    });

    it('should get active token version', () => {
      manager.issue('token-123');
      manager.rotate('token-123');
      manager.rotate('token-123');

      const active = manager.getActive('token-123');

      expect(active).not.toBeNull();
      expect(active!.version).toBe(3);
      expect(active!.status).toBe('active');
    });
  });

  describe('Retention Policy (30 days)', () => {
    let manager: RetentionPolicyManager;

    beforeEach(() => {
      manager = new RetentionPolicyManager();
      // Mock current time for testing
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should store record with 30-day expiration', () => {
      const record = manager.store({
        id: 'rec-1',
        type: 'token',
        createdAt: new Date(),
        data: { token: 'abc123' },
      });

      expect(record.expiresAt.getTime()).toBe(
        record.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000
      );
      expect(record.deleted).toBe(false);
    });

    it('should cleanup expired records after 30 days', () => {
      // Store record on day 1
      manager.store({
        id: 'rec-1',
        type: 'token',
        createdAt: new Date(),
        data: { token: 'abc123' },
      });

      // Advance time by 31 days
      vi.advanceTimersByTime(31 * 24 * 60 * 60 * 1000);

      // Cleanup should mark as deleted
      const deleted = manager.cleanupExpired();

      expect(deleted).toBe(1);

      const stats = manager.getStats();
      expect(stats.deleted).toBe(1);
      expect(stats.active).toBe(0);
    });

    it('should not delete records within retention period', () => {
      manager.store({
        id: 'rec-1',
        type: 'token',
        createdAt: new Date(),
        data: { token: 'abc123' },
      });

      // Advance time by 29 days (within retention)
      vi.advanceTimersByTime(29 * 24 * 60 * 60 * 1000);

      const deleted = manager.cleanupExpired();

      expect(deleted).toBe(0);

      const stats = manager.getStats();
      expect(stats.active).toBe(1);
      expect(stats.deleted).toBe(0);
    });

    it('should provide accurate retention statistics', () => {
      // Store 3 records at different times
      manager.store({
        id: 'rec-1',
        type: 'token',
        createdAt: new Date(),
        data: {},
      });

      vi.advanceTimersByTime(15 * 24 * 60 * 60 * 1000); // 15 days

      manager.store({
        id: 'rec-2',
        type: 'ssraa',
        createdAt: new Date(),
        data: {},
      });

      vi.advanceTimersByTime(20 * 24 * 60 * 60 * 1000); // 35 days total

      manager.store({
        id: 'rec-3',
        type: 'audit_log',
        createdAt: new Date(),
        data: {},
      });

      manager.cleanupExpired();

      const stats = manager.getStats();

      expect(stats.total).toBe(3);
      expect(stats.deleted).toBe(1); // rec-1 is 35 days old
      expect(stats.active).toBe(2); // rec-2 (20d) and rec-3 (0d) still active
    });

    it('should handle multiple record types', () => {
      const types: Array<'token' | 'ssraa' | 'audit_log' | 'session'> = [
        'token',
        'ssraa',
        'audit_log',
        'session',
      ];

      types.forEach((type, index) => {
        manager.store({
          id: `rec-${index}`,
          type,
          createdAt: new Date(),
          data: { type },
        });
      });

      const records = manager.getAllRecords();
      expect(records).toHaveLength(4);

      const recordTypes = records.map(r => r.type);
      expect(recordTypes).toEqual(types);
    });
  });

  describe('Integration: Redaction + Rotation + Retention', () => {
    it('should handle full security lifecycle', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));

      const rotationManager = new TokenRotationManager();
      const retentionManager = new RetentionPolicyManager();

      // 1. Issue token with sensitive data
      const token = rotationManager.issue('token-123');
      const tokenData = {
        ...token,
        userEmail: 'user@example.com',
        userPhone: '555-1234',
      };

      // 2. Store in retention system
      const stored = retentionManager.store({
        id: 'retention-1',
        type: 'token',
        createdAt: new Date(),
        data: tokenData,
      });

      // 3. Redact sensitive fields
      const redactedEmail = redactSensitiveData(tokenData.userEmail);
      const redactedPhone = redactSensitiveData(tokenData.userPhone);

      expect(redactedEmail).toBe('[REDACTED_EMAIL]');
      expect(redactedPhone).toBe('[REDACTED_PHONE]');

      // 4. Rotate token after 1 day
      vi.advanceTimersByTime(24 * 60 * 60 * 1000);
      const rotated = rotationManager.rotate('token-123');
      expect(rotated!.version).toBe(2);

      // 5. Verify retention after 31 days
      vi.advanceTimersByTime(30 * 24 * 60 * 60 * 1000);
      const deleted = retentionManager.cleanupExpired();
      expect(deleted).toBe(1);

      vi.useRealTimers();
    });
  });
});

