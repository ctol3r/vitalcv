/**
 * B139A-INTL-007: Tests for Cross-Region Directory Sync
 */

import {
  hashProviderId,
  sanitizeProviderRecord,
  syncRegion,
  getSyncLogs,
  clearSyncLogs,
  getSyncMetrics,
  ProviderDirectoryRecord,
} from '../regionSync';
import { Region } from '../../org/models/TenantRegion';

describe('Cross-Region Directory Sync', () => {
  beforeEach(() => {
    clearSyncLogs();
  });

  describe('hashProviderId', () => {
    it('should generate consistent SHA-256 hash', () => {
      const npi = '1234567890';
      const hash1 = hashProviderId(npi);
      const hash2 = hashProviderId(npi);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex characters
    });

    it('should generate different hashes for different IDs', () => {
      const hash1 = hashProviderId('1234567890');
      const hash2 = hashProviderId('0987654321');

      expect(hash1).not.toBe(hash2);
    });

    it('should be deterministic', () => {
      const npi = '1234567890';
      const hashes = Array.from({ length: 10 }, () => hashProviderId(npi));

      expect(new Set(hashes).size).toBe(1); // All hashes should be identical
    });
  });

  describe('sanitizeProviderRecord', () => {
    it('should sanitize provider record with all fields', () => {
      const raw = {
        id: 'provider-123',
        npi: '1234567890',
        firstName: 'Jane',
        lastName: 'Smith',
        displayName: 'Dr. Jane Smith',
        specialty: 'Cardiology',
        licenseStates: ['CA', 'NY'],
        compactStatus: 'IMLC_ACTIVE',
        certifications: ['Board Certified', 'ACLS'],
        languages: ['English', 'Spanish'],
        regionSource: Region.US,
        lastUpdated: new Date('2025-11-01'),
        // PHI fields that should be removed:
        ssn: '123-45-6789',
        dateOfBirth: '1980-01-15',
        homeAddress: '123 Main St',
      };

      const sanitized = sanitizeProviderRecord(raw);

      expect(sanitized.providerHash).toBeDefined();
      expect(sanitized.displayName).toBe('Dr. Jane Smith');
      expect(sanitized.specialty).toBe('Cardiology');
      expect(sanitized.licenseStates).toEqual(['CA', 'NY']);
      expect(sanitized.compactStatus).toBe('IMLC_ACTIVE');
      expect(sanitized.regionSource).toBe(Region.US);

      // PHI should not be included
      expect(sanitized).not.toHaveProperty('ssn');
      expect(sanitized).not.toHaveProperty('dateOfBirth');
      expect(sanitized).not.toHaveProperty('homeAddress');
    });

    it('should handle minimal provider record', () => {
      const raw = {
        id: 'provider-456',
        firstName: 'John',
        lastName: 'Doe',
      };

      const sanitized = sanitizeProviderRecord(raw);

      expect(sanitized.providerHash).toBeDefined();
      expect(sanitized.displayName).toBe('John Doe');
      expect(sanitized.licenseStates).toEqual([]);
      expect(sanitized.lastUpdated).toBeInstanceOf(Date);
    });

    it('should use NPI for hashing if ID not present', () => {
      const raw = {
        npi: '1234567890',
        displayName: 'Dr. Test',
      };

      const sanitized = sanitizeProviderRecord(raw);

      expect(sanitized.providerHash).toBe(hashProviderId('1234567890'));
    });
  });

  describe('syncRegion', () => {
    it('should complete sync with no changes', async () => {
      const stats = await syncRegion(Region.US, Region.EU);

      expect(stats).toBeDefined();
      expect(stats.runId).toBeDefined();
      expect(stats.sourceRegion).toBe(Region.US);
      expect(stats.targetRegion).toBe(Region.EU);
      expect(stats.startTime).toBeInstanceOf(Date);
      expect(stats.endTime).toBeInstanceOf(Date);
    });

    it('should log sync run', async () => {
      await syncRegion(Region.US, Region.EU);

      const logs = getSyncLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].sourceRegion).toBe(Region.US);
      expect(logs[0].targetRegion).toBe(Region.EU);
    });

    it('should support differential sync with lastSyncTime', async () => {
      const lastSyncTime = new Date('2025-11-01');

      const stats = await syncRegion(Region.US, Region.EU, lastSyncTime);

      expect(stats).toBeDefined();
    });
  });

  describe('getSyncLogs', () => {
    it('should filter logs by sourceRegion', async () => {
      await syncRegion(Region.US, Region.EU);
      await syncRegion(Region.EU, Region.US);
      await syncRegion(Region.AU, Region.US);

      const usSourceLogs = getSyncLogs({ sourceRegion: Region.US });
      expect(usSourceLogs).toHaveLength(1);
      expect(usSourceLogs[0].sourceRegion).toBe(Region.US);
    });

    it('should filter logs by targetRegion', async () => {
      await syncRegion(Region.US, Region.EU);
      await syncRegion(Region.AU, Region.EU);
      await syncRegion(Region.US, Region.AU);

      const euTargetLogs = getSyncLogs({ targetRegion: Region.EU });
      expect(euTargetLogs).toHaveLength(2);
      expect(euTargetLogs.every(log => log.targetRegion === Region.EU)).toBe(true);
    });

    it('should filter logs by date range', async () => {
      const startDate = new Date();

      await syncRegion(Region.US, Region.EU);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      const endDate = new Date();

      await syncRegion(Region.EU, Region.US);

      const filteredLogs = getSyncLogs({ startDate, endDate });
      expect(filteredLogs).toHaveLength(1);
    });
  });

  describe('getSyncMetrics', () => {
    it('should calculate metrics from sync logs', async () => {
      await syncRegion(Region.US, Region.EU);
      await syncRegion(Region.EU, Region.AU);
      await syncRegion(Region.AU, Region.US);

      const metrics = getSyncMetrics();

      expect(metrics.totalRuns).toBe(3);
      expect(metrics.bySourceRegion[Region.US].runs).toBe(1);
      expect(metrics.bySourceRegion[Region.EU].runs).toBe(1);
      expect(metrics.bySourceRegion[Region.AU].runs).toBe(1);
    });

    it('should track successful and failed runs', async () => {
      await syncRegion(Region.US, Region.EU);

      const metrics = getSyncMetrics();

      expect(metrics.successfulRuns).toBe(1);
      expect(metrics.failedRuns).toBe(0);
    });

    it('should calculate average duration', async () => {
      await syncRegion(Region.US, Region.EU);
      await syncRegion(Region.EU, Region.AU);

      const metrics = getSyncMetrics();

      expect(metrics.averageDuration).toBeGreaterThan(0);
    });
  });

  describe('Hash consistency', () => {
    it('should ensure same provider always gets same hash', () => {
      const npi = '1234567890';

      const hashes = [
        hashProviderId(npi),
        hashProviderId(npi),
        hashProviderId(npi),
      ];

      expect(new Set(hashes).size).toBe(1);
    });

    it('should ensure different providers get different hashes', () => {
      const hashes = [
        hashProviderId('1111111111'),
        hashProviderId('2222222222'),
        hashProviderId('3333333333'),
      ];

      expect(new Set(hashes).size).toBe(3);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete sync workflow', async () => {
      // Sync US → EU
      const stats1 = await syncRegion(Region.US, Region.EU);

      // Sync EU → AU
      const stats2 = await syncRegion(Region.EU, Region.AU);

      // Get all logs
      const logs = getSyncLogs();
      expect(logs).toHaveLength(2);

      // Get metrics
      const metrics = getSyncMetrics();
      expect(metrics.totalRuns).toBe(2);
    });

    it('should sanitize and hash provider data correctly', () => {
      const providers = [
        { id: 'p1', npi: '1111111111', firstName: 'Alice', lastName: 'Johnson', specialty: 'Pediatrics' },
        { id: 'p2', npi: '2222222222', firstName: 'Bob', lastName: 'Williams', specialty: 'Surgery' },
        { id: 'p3', npi: '3333333333', firstName: 'Carol', lastName: 'Brown', specialty: 'Neurology' },
      ];

      const sanitized = providers.map(p => sanitizeProviderRecord(p));

      expect(sanitized).toHaveLength(3);
      expect(sanitized.every(s => s.providerHash.length === 64)).toBe(true);
      expect(new Set(sanitized.map(s => s.providerHash)).size).toBe(3);
    });
  });
});

