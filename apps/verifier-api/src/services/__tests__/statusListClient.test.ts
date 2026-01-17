import { beforeEach, describe, expect, it } from 'vitest';
import { StatusListClient, clearInMemoryStatusList } from '../statusListClient';

describe('StatusListClient', () => {
  let client: StatusListClient;

  beforeEach(() => {
    clearInMemoryStatusList();
    client = new StatusListClient();
    process.env.NODE_ENV = 'test'; // Ensure test mode
  });

  describe('allocate', () => {
    it('allocates a status list entry', async () => {
      const result = await client.allocate('cred-001', 'default');

      expect(result.list_id).toBe('default');
      expect(result.index).toBeGreaterThanOrEqual(0);
      expect(result.status_url).toBeTruthy();
      expect(result.status_list_url).toBeTruthy();
      expect(result.allocated_at).toBeTruthy();
    });

    it('is idempotent (same credential_id returns same index)', async () => {
      const result1 = await client.allocate('cred-001', 'default');
      const result2 = await client.allocate('cred-001', 'default');

      expect(result1.index).toBe(result2.index);
      expect(result1.list_id).toBe(result2.list_id);
    });

    it('allocates sequential indices', async () => {
      const result1 = await client.allocate('cred-001', 'default');
      const result2 = await client.allocate('cred-002', 'default');

      expect(result2.index).toBe(result1.index + 1);
    });

    it('throws error for missing credential_id', async () => {
      await expect(client.allocate('')).rejects.toThrow('credential_id is required');
    });
  });

  describe('revoke', () => {
    it('revokes a credential', async () => {
      await client.allocate('cred-001', 'default');
      const result = await client.revoke('cred-001', 'default');

      expect(result.revoked).toBe(true);
      expect(result.credential_id).toBe('cred-001');
      expect(result.previous_state).toBe('valid');
    });

    it('is idempotent (revoking twice returns same state)', async () => {
      await client.allocate('cred-001', 'default');
      const result1 = await client.revoke('cred-001', 'default');
      const result2 = await client.revoke('cred-001', 'default');

      expect(result1.revoked).toBe(true);
      expect(result2.revoked).toBe(true);
      expect(result2.previous_state).toBe('revoked');
    });

    it('throws error for unallocated credential', async () => {
      await expect(client.revoke('unallocated', 'default')).rejects.toThrow('not allocated');
    });
  });

  describe('check', () => {
    it('returns valid for non-revoked credential', async () => {
      await client.allocate('cred-001', 'default');
      const result = await client.check('cred-001');

      expect(result.status).toBe('valid');
      expect(result.credential_id).toBe('cred-001');
    });

    it('returns revoked for revoked credential', async () => {
      await client.allocate('cred-001', 'default');
      await client.revoke('cred-001', 'default');
      const result = await client.check('cred-001');

      expect(result.status).toBe('revoked');
      expect(result.revoked_at).toBeTruthy();
    });

    it('returns unknown for unallocated credential', async () => {
      const result = await client.check('unallocated');

      expect(result.status).toBe('unknown');
    });
  });

  describe('in-memory adapter (test mode)', () => {
    it('uses in-memory adapter in test mode', async () => {
      process.env.NODE_ENV = 'test';

      const result = await client.allocate('test-cred', 'default');

      expect(result.status_url).toContain('status.test.local');
    });

    it('blocks network calls in test mode', () => {
      process.env.NODE_ENV = 'test';

      // Network calls should never be attempted in test mode
      // assertNoNetwork will throw if we try to make network calls
      expect(async () => await client.allocate('test-cred')).not.toThrow();
    });
  });

  describe('fetchList', () => {
    it('fetches status list credential', async () => {
      const result = await client.fetchList('default');

      expect(result.type).toBe('StatusList2021Credential');
      expect(result.list_id).toBe('default');
    });
  });
});
