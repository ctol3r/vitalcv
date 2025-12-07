/**
 * B139A-INTL-004: Tests for Data Residency Guard
 */

import {
  evaluateRegionAccess,
  checkRegionAccess,
  enforceRegionAccess,
  isPhiResource,
  getResourceClassification,
  canSyncAcrossRegions,
  getAuditLogs,
  clearAuditLogs,
  getRegionGuardMetrics,
  getSyncableResourceTypes,
  getPhiResourceTypes,
  validateTenantRegion,
  withRegionGuard,
  RegionAccessDeniedError,
  DataClassification,
  AccessContext,
} from '../regionGuard';
import { Region } from '../../org/models/TenantRegion';

describe('Region Guard', () => {
  beforeEach(() => {
    clearAuditLogs();
  });

  describe('getResourceClassification', () => {
    it('should classify patients as PHI', () => {
      expect(getResourceClassification('patients')).toBe(DataClassification.PHI);
    });

    it('should classify providerCredentials as NON_PHI', () => {
      expect(getResourceClassification('providerCredentials')).toBe(DataClassification.NON_PHI);
    });

    it('should classify publicDirectory as PUBLIC', () => {
      expect(getResourceClassification('publicDirectory')).toBe(DataClassification.PUBLIC);
    });

    it('should default unknown resources to PHI for safety', () => {
      expect(getResourceClassification('unknownResource')).toBe(DataClassification.PHI);
    });
  });

  describe('isPhiResource', () => {
    it('should return true for PHI resources', () => {
      expect(isPhiResource('patients')).toBe(true);
      expect(isPhiResource('encounters')).toBe(true);
      expect(isPhiResource('clinicalNotes')).toBe(true);
    });

    it('should return false for non-PHI resources', () => {
      expect(isPhiResource('providerCredentials')).toBe(false);
      expect(isPhiResource('publicDirectory')).toBe(false);
    });
  });

  describe('evaluateRegionAccess', () => {
    describe('Same region access', () => {
      it('should allow same region PHI access', () => {
        const context: AccessContext = {
          tenantId: 'tenant-1',
          resourceType: 'patients',
          operation: 'read',
          sourceRegion: Region.US,
          targetRegion: Region.US,
        };

        const decision = evaluateRegionAccess(context);

        expect(decision.allowed).toBe(true);
        expect(decision.reason).toBe('Same region access');
        expect(decision.requiresAudit).toBe(false);
      });
    });

    describe('Cross-region PHI access', () => {
      it('should deny cross-region PHI access', () => {
        const context: AccessContext = {
          tenantId: 'tenant-1',
          resourceType: 'patients',
          operation: 'read',
          sourceRegion: Region.US,
          targetRegion: Region.EU,
        };

        const decision = evaluateRegionAccess(context);

        expect(decision.allowed).toBe(false);
        expect(decision.reason).toBe('PHI data cannot cross region boundaries');
        expect(decision.classification).toBe(DataClassification.PHI);
        expect(decision.requiresAudit).toBe(true);
      });

      it('should deny cross-region access for all PHI resource types', () => {
        const phiResources = [
          'patients',
          'encounters',
          'observations',
          'clinicalNotes',
          'labResults',
          'medications',
        ];

        for (const resourceType of phiResources) {
          const context: AccessContext = {
            tenantId: 'tenant-1',
            resourceType,
            operation: 'read',
            sourceRegion: Region.US,
            targetRegion: Region.EU,
          };

          const decision = evaluateRegionAccess(context);
          expect(decision.allowed).toBe(false);
          expect(decision.classification).toBe(DataClassification.PHI);
        }
      });
    });

    describe('Cross-region non-PHI access', () => {
      it('should allow cross-region non-PHI access with audit', () => {
        const context: AccessContext = {
          tenantId: 'tenant-1',
          resourceType: 'providerCredentials',
          operation: 'read',
          sourceRegion: Region.US,
          targetRegion: Region.EU,
        };

        const decision = evaluateRegionAccess(context);

        expect(decision.allowed).toBe(true);
        expect(decision.reason).toBe('Non-PHI data - cross-region access permitted');
        expect(decision.requiresAudit).toBe(true);
      });
    });

    describe('Cross-region PII access', () => {
      it('should deny PII access without valid purpose', () => {
        const context: AccessContext = {
          tenantId: 'tenant-1',
          resourceType: 'providerEmploymentHistory',
          operation: 'read',
          sourceRegion: Region.US,
          targetRegion: Region.EU,
        };

        const decision = evaluateRegionAccess(context);

        expect(decision.allowed).toBe(false);
        expect(decision.reason).toContain('not permitted without valid purpose');
      });

      it('should allow PII access for directory_sync purpose', () => {
        const context: AccessContext = {
          tenantId: 'tenant-1',
          resourceType: 'providerEmploymentHistory',
          operation: 'read',
          sourceRegion: Region.US,
          targetRegion: Region.EU,
          purpose: 'directory_sync',
        };

        const decision = evaluateRegionAccess(context);

        expect(decision.allowed).toBe(true);
        expect(decision.warnings).toContain('Cross-region PII access - ensure minimal necessary data');
      });

      it('should allow PII access for credential_verification purpose', () => {
        const context: AccessContext = {
          tenantId: 'tenant-1',
          resourceType: 'providerContactInfo',
          operation: 'read',
          sourceRegion: Region.US,
          targetRegion: Region.EU,
          purpose: 'credential_verification',
        };

        const decision = evaluateRegionAccess(context);

        expect(decision.allowed).toBe(true);
      });
    });

    describe('Cross-region public data access', () => {
      it('should allow public data access without audit', () => {
        const context: AccessContext = {
          tenantId: 'tenant-1',
          resourceType: 'publicDirectory',
          operation: 'read',
          sourceRegion: Region.US,
          targetRegion: Region.EU,
        };

        const decision = evaluateRegionAccess(context);

        expect(decision.allowed).toBe(true);
        expect(decision.reason).toBe('Public data - no region restrictions');
        expect(decision.requiresAudit).toBe(false);
      });
    });
  });

  describe('checkRegionAccess', () => {
    it('should evaluate and log denied access', () => {
      const context: AccessContext = {
        tenantId: 'tenant-1',
        resourceType: 'patients',
        operation: 'read',
        sourceRegion: Region.US,
        targetRegion: Region.EU,
      };

      const decision = checkRegionAccess(context);

      expect(decision.allowed).toBe(false);

      const logs = getAuditLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].allowed).toBe(false);
      expect(logs[0].resourceType).toBe('patients');
    });

    it('should log allowed cross-region non-PHI access', () => {
      const context: AccessContext = {
        tenantId: 'tenant-1',
        resourceType: 'providerCredentials',
        operation: 'read',
        sourceRegion: Region.US,
        targetRegion: Region.EU,
      };

      const decision = checkRegionAccess(context);

      expect(decision.allowed).toBe(true);

      const logs = getAuditLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].allowed).toBe(true);
    });

    it('should not log same-region access for non-auditable resources', () => {
      const context: AccessContext = {
        tenantId: 'tenant-1',
        resourceType: 'publicDirectory',
        operation: 'read',
        sourceRegion: Region.US,
        targetRegion: Region.US,
      };

      checkRegionAccess(context);

      const logs = getAuditLogs();
      expect(logs).toHaveLength(0);
    });
  });

  describe('enforceRegionAccess', () => {
    it('should throw RegionAccessDeniedError for denied access', () => {
      const context: AccessContext = {
        tenantId: 'tenant-1',
        resourceType: 'patients',
        operation: 'read',
        sourceRegion: Region.US,
        targetRegion: Region.EU,
      };

      expect(() => enforceRegionAccess(context)).toThrow(RegionAccessDeniedError);
    });

    it('should not throw for allowed access', () => {
      const context: AccessContext = {
        tenantId: 'tenant-1',
        resourceType: 'patients',
        operation: 'read',
        sourceRegion: Region.US,
        targetRegion: Region.US,
      };

      expect(() => enforceRegionAccess(context)).not.toThrow();
    });

    it('should include region details in error', () => {
      const context: AccessContext = {
        tenantId: 'tenant-1',
        resourceType: 'patients',
        operation: 'read',
        sourceRegion: Region.US,
        targetRegion: Region.EU,
      };

      try {
        enforceRegionAccess(context);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RegionAccessDeniedError);
        const err = error as RegionAccessDeniedError;
        expect(err.resourceType).toBe('patients');
        expect(err.sourceRegion).toBe(Region.US);
        expect(err.targetRegion).toBe(Region.EU);
      }
    });
  });

  describe('getAuditLogs', () => {
    it('should filter logs by tenantId', () => {
      checkRegionAccess({
        tenantId: 'tenant-1',
        resourceType: 'patients',
        operation: 'read',
        sourceRegion: Region.US,
        targetRegion: Region.EU,
      });

      checkRegionAccess({
        tenantId: 'tenant-2',
        resourceType: 'patients',
        operation: 'read',
        sourceRegion: Region.US,
        targetRegion: Region.EU,
      });

      const logs = getAuditLogs({ tenantId: 'tenant-1' });
      expect(logs).toHaveLength(1);
      expect(logs[0].tenantId).toBe('tenant-1');
    });

    it('should filter logs by allowed status', () => {
      checkRegionAccess({
        tenantId: 'tenant-1',
        resourceType: 'patients',
        operation: 'read',
        sourceRegion: Region.US,
        targetRegion: Region.EU, // Denied
      });

      checkRegionAccess({
        tenantId: 'tenant-1',
        resourceType: 'providerCredentials',
        operation: 'read',
        sourceRegion: Region.US,
        targetRegion: Region.EU, // Allowed
      });

      const deniedLogs = getAuditLogs({ allowed: false });
      expect(deniedLogs).toHaveLength(1);
      expect(deniedLogs[0].allowed).toBe(false);

      const allowedLogs = getAuditLogs({ allowed: true });
      expect(allowedLogs).toHaveLength(1);
      expect(allowedLogs[0].allowed).toBe(true);
    });

    it('should filter logs by classification', () => {
      checkRegionAccess({
        tenantId: 'tenant-1',
        resourceType: 'patients',
        operation: 'read',
        sourceRegion: Region.US,
        targetRegion: Region.EU,
      });

      checkRegionAccess({
        tenantId: 'tenant-1',
        resourceType: 'providerCredentials',
        operation: 'read',
        sourceRegion: Region.US,
        targetRegion: Region.EU,
      });

      const phiLogs = getAuditLogs({ classification: DataClassification.PHI });
      expect(phiLogs).toHaveLength(1);
      expect(phiLogs[0].classification).toBe(DataClassification.PHI);
    });
  });

  describe('getRegionGuardMetrics', () => {
    it('should calculate correct metrics', () => {
      // Denied PHI access
      checkRegionAccess({
        tenantId: 'tenant-1',
        resourceType: 'patients',
        operation: 'read',
        sourceRegion: Region.US,
        targetRegion: Region.EU,
      });

      // Allowed non-PHI access
      checkRegionAccess({
        tenantId: 'tenant-1',
        resourceType: 'providerCredentials',
        operation: 'read',
        sourceRegion: Region.US,
        targetRegion: Region.EU,
      });

      // Another denied PHI access
      checkRegionAccess({
        tenantId: 'tenant-1',
        resourceType: 'clinicalNotes',
        operation: 'read',
        sourceRegion: Region.US,
        targetRegion: Region.AU,
      });

      const metrics = getRegionGuardMetrics();

      expect(metrics.totalRequests).toBe(3);
      expect(metrics.allowed).toBe(1);
      expect(metrics.denied).toBe(2);
      expect(metrics.byClassification[DataClassification.PHI].denied).toBe(2);
      expect(metrics.byClassification[DataClassification.NON_PHI].allowed).toBe(1);
    });
  });

  describe('canSyncAcrossRegions', () => {
    it('should allow sync for non-PHI resources', () => {
      expect(canSyncAcrossRegions('providerCredentials')).toBe(true);
      expect(canSyncAcrossRegions('compactStatus')).toBe(true);
    });

    it('should allow sync for public resources', () => {
      expect(canSyncAcrossRegions('publicDirectory')).toBe(true);
    });

    it('should not allow sync for PHI resources', () => {
      expect(canSyncAcrossRegions('patients')).toBe(false);
      expect(canSyncAcrossRegions('clinicalNotes')).toBe(false);
    });
  });

  describe('getSyncableResourceTypes', () => {
    it('should return only non-PHI and public resources', () => {
      const syncable = getSyncableResourceTypes();

      expect(syncable).toContain('providerCredentials');
      expect(syncable).toContain('publicDirectory');
      expect(syncable).not.toContain('patients');
      expect(syncable).not.toContain('clinicalNotes');
    });
  });

  describe('getPhiResourceTypes', () => {
    it('should return only PHI resources', () => {
      const phi = getPhiResourceTypes();

      expect(phi).toContain('patients');
      expect(phi).toContain('clinicalNotes');
      expect(phi).toContain('encounters');
      expect(phi).not.toContain('providerCredentials');
      expect(phi).not.toContain('publicDirectory');
    });
  });

  describe('validateTenantRegion', () => {
    it('should not throw for same region', () => {
      expect(() =>
        validateTenantRegion('tenant-1', 'patients', Region.US, Region.US)
      ).not.toThrow();
    });

    it('should throw for PHI access across regions', () => {
      expect(() =>
        validateTenantRegion('tenant-1', 'patients', Region.US, Region.EU)
      ).toThrow(RegionAccessDeniedError);
    });
  });

  describe('withRegionGuard', () => {
    it('should execute query for allowed access', async () => {
      const mockQuery = jest.fn().mockResolvedValue({ rows: [] });

      const result = await withRegionGuard(
        {
          tenantId: 'tenant-1',
          resourceType: 'patients',
          operation: 'read',
          sourceRegion: Region.US,
          targetRegion: Region.US,
        },
        mockQuery
      );

      expect(mockQuery).toHaveBeenCalled();
      expect(result).toEqual({ rows: [] });
    });

    it('should prevent query execution for denied access', async () => {
      const mockQuery = jest.fn().mockResolvedValue({ rows: [] });

      await expect(
        withRegionGuard(
          {
            tenantId: 'tenant-1',
            resourceType: 'patients',
            operation: 'read',
            sourceRegion: Region.US,
            targetRegion: Region.EU, // Cross-region PHI - denied
          },
          mockQuery
        )
      ).rejects.toThrow(RegionAccessDeniedError);

      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe('Multi-region scenarios', () => {
    it('should handle US -> EU PHI access attempt (denied)', () => {
      const decision = checkRegionAccess({
        tenantId: 'tenant-1',
        resourceType: 'patients',
        operation: 'read',
        sourceRegion: Region.US,
        targetRegion: Region.EU,
      });

      expect(decision.allowed).toBe(false);
      expect(decision.classification).toBe(DataClassification.PHI);
    });

    it('should handle US -> EU non-PHI access (allowed)', () => {
      const decision = checkRegionAccess({
        tenantId: 'tenant-1',
        resourceType: 'providerLicenses',
        operation: 'read',
        sourceRegion: Region.US,
        targetRegion: Region.EU,
      });

      expect(decision.allowed).toBe(true);
      expect(decision.requiresAudit).toBe(true);
    });

    it('should handle AU -> US PHI access attempt (denied)', () => {
      const decision = checkRegionAccess({
        tenantId: 'tenant-1',
        resourceType: 'encounters',
        operation: 'write',
        sourceRegion: Region.AU,
        targetRegion: Region.US,
      });

      expect(decision.allowed).toBe(false);
    });
  });

  describe('RegionAccessDeniedError', () => {
    it('should serialize to JSON correctly', () => {
      const error = new RegionAccessDeniedError(
        'Test reason',
        'patients',
        Region.US,
        Region.EU
      );

      const json = error.toJSON();

      expect(json.code).toBe('REGION_ACCESS_DENIED');
      expect(json.reason).toBe('Test reason');
      expect(json.resourceType).toBe('patients');
      expect(json.sourceRegion).toBe(Region.US);
      expect(json.targetRegion).toBe(Region.EU);
    });
  });
});

