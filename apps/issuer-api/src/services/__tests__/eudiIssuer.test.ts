/**
 * B139A-EUDI-006: Tests for EUDI Wallet VC Issuance
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Region } from '../../../../../services/org/models/TenantRegion';
import {
  batchIssueEudiCredentials,
  clearEudiAuditLogs,
  EudiCredentialRequest,
  EudiCredentialType,
  EudiIssuanceError,
  getCurrentRegion,
  getEudiAuditLogs,
  getEudiIssuanceMetrics,
  isEudiIssuanceAvailable,
  issueEudiCredential,
  validateEudiCountry,
  validateEudiRegion,
} from '../eudiIssuer';

// Mock environment
const originalEnv = process.env;

describe('EUDI Issuer Service', () => {
  beforeEach(() => {
    clearEudiAuditLogs();
    process.env = { ...originalEnv };
    process.env.DEFAULT_HOLDER_JKT = 'test-holder-jkt';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validateEudiRegion', () => {
    it('should not throw if current region is EU', () => {
      process.env.CLUSTER_REGION = Region.EU;

      expect(() => validateEudiRegion()).not.toThrow();
    });

    it('should throw if current region is US', () => {
      process.env.CLUSTER_REGION = Region.US;

      expect(() => validateEudiRegion()).toThrow(EudiIssuanceError);
      expect(() => validateEudiRegion()).toThrow(/can only be issued in EU region/);
    });

    it('should throw if current region is AU', () => {
      process.env.CLUSTER_REGION = Region.AU;

      expect(() => validateEudiRegion()).toThrow(EudiIssuanceError);
    });
  });

  describe('validateEudiCountry', () => {
    it('should not throw for EEA countries', () => {
      expect(() => validateEudiCountry('DE')).not.toThrow();
      expect(() => validateEudiCountry('FR')).not.toThrow();
      expect(() => validateEudiCountry('NO')).not.toThrow();
    });

    it('should throw for non-EEA countries', () => {
      expect(() => validateEudiCountry('US')).toThrow(EudiIssuanceError);
      expect(() => validateEudiCountry('AU')).toThrow(EudiIssuanceError);
      expect(() => validateEudiCountry('CA')).toThrow(EudiIssuanceError);
    });

    it('should include country code in error', () => {
      try {
        validateEudiCountry('US');
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(EudiIssuanceError);
        const err = error as EudiIssuanceError;
        expect(err.code).toBe('COUNTRY_NOT_ELIGIBLE');
        expect(err.countryCode).toBe('US');
      }
    });
  });

  describe('issueEudiCredential - EU region', () => {
    beforeEach(() => {
      process.env.CLUSTER_REGION = Region.EU;
    });

    it('should issue credential for German provider', async () => {
      const request: EudiCredentialRequest = {
        credentialType: EudiCredentialType.MEDICAL_LICENSE,
        subjectDid: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        countryCode: 'DE',
        claims: {
          licenseNumber: 'DE-12345',
          specialty: 'Cardiology',
          issuingAuthority: 'German Medical Association',
        },
      };

      const response = await issueEudiCredential(request);

      expect(response).toBeDefined();
      expect(response.credentialType).toBe(EudiCredentialType.MEDICAL_LICENSE);
      expect(response.format).toBe('vc+sd-jwt');
      expect(response.issuanceDate).toBeInstanceOf(Date);
    });

    it('should issue credential for French provider', async () => {
      const request: EudiCredentialRequest = {
        credentialType: EudiCredentialType.NURSING_LICENSE,
        subjectDid: 'did:key:z6MkrHKzgsahxBLyNAbLQyB1pcWNYC9GmywiWPgkrvntAZcj',
        countryCode: 'FR',
        claims: {
          licenseNumber: 'FR-98765',
          specialty: 'Emergency Nursing',
        },
      };

      const response = await issueEudiCredential(request);

      expect(response.credentialType).toBe(EudiCredentialType.NURSING_LICENSE);
    });

    it('should log successful issuance', async () => {
      const request: EudiCredentialRequest = {
        credentialType: EudiCredentialType.MEDICAL_LICENSE,
        subjectDid: 'did:key:test',
        countryCode: 'DE',
        claims: {},
      };

      await issueEudiCredential(request);

      const logs = getEudiAuditLogs({ allowed: true });
      expect(logs).toHaveLength(1);
      expect(logs[0].credentialType).toBe(EudiCredentialType.MEDICAL_LICENSE);
      expect(logs[0].countryCode).toBe('DE');
      expect(logs[0].allowed).toBe(true);
    });

    it('should handle validity period', async () => {
      const notAfter = new Date('2030-12-31');

      const request: EudiCredentialRequest = {
        credentialType: EudiCredentialType.MEDICAL_LICENSE,
        subjectDid: 'did:key:test',
        countryCode: 'DE',
        claims: {},
        validityPeriod: {
          notAfter,
        },
      };

      const response = await issueEudiCredential(request);

      expect(response.expirationDate).toEqual(notAfter);
    });
  });

  describe('issueEudiCredential - US region (denied)', () => {
    beforeEach(() => {
      process.env.CLUSTER_REGION = Region.US;
    });

    it('should deny issuance from US region', async () => {
      const request: EudiCredentialRequest = {
        credentialType: EudiCredentialType.MEDICAL_LICENSE,
        subjectDid: 'did:key:test',
        countryCode: 'DE',
        claims: {},
      };

      await expect(issueEudiCredential(request)).rejects.toThrow(EudiIssuanceError);
      await expect(issueEudiCredential(request)).rejects.toThrow(/can only be issued in EU region/);
    });

    it('should log denied issuance', async () => {
      const request: EudiCredentialRequest = {
        credentialType: EudiCredentialType.MEDICAL_LICENSE,
        subjectDid: 'did:key:test',
        countryCode: 'DE',
        claims: {},
      };

      try {
        await issueEudiCredential(request);
        throw new Error('Should have thrown');
      } catch (error) {
        // Expected
      }

      const logs = getEudiAuditLogs({ allowed: false });
      expect(logs).toHaveLength(1);
      expect(logs[0].allowed).toBe(false);
      expect(logs[0].currentRegion).toBe(Region.US);
    });
  });

  describe('issueEudiCredential - AU region (denied)', () => {
    beforeEach(() => {
      process.env.CLUSTER_REGION = Region.AU;
    });

    it('should deny issuance from AU region', async () => {
      const request: EudiCredentialRequest = {
        credentialType: EudiCredentialType.MEDICAL_LICENSE,
        subjectDid: 'did:key:test',
        countryCode: 'DE',
        claims: {},
      };

      await expect(issueEudiCredential(request)).rejects.toThrow(EudiIssuanceError);
    });
  });

  describe('issueEudiCredential - Non-EEA country (denied)', () => {
    beforeEach(() => {
      process.env.CLUSTER_REGION = Region.EU;
    });

    it('should deny issuance for US provider', async () => {
      const request: EudiCredentialRequest = {
        credentialType: EudiCredentialType.MEDICAL_LICENSE,
        subjectDid: 'did:key:test',
        countryCode: 'US',
        claims: {},
      };

      await expect(issueEudiCredential(request)).rejects.toThrow(EudiIssuanceError);
      await expect(issueEudiCredential(request)).rejects.toThrow(/not eligible for EUDI Wallet/);
    });

    it('should deny issuance for AU provider', async () => {
      const request: EudiCredentialRequest = {
        credentialType: EudiCredentialType.MEDICAL_LICENSE,
        subjectDid: 'did:key:test',
        countryCode: 'AU',
        claims: {},
      };

      await expect(issueEudiCredential(request)).rejects.toThrow(EudiIssuanceError);
    });
  });

  describe('batchIssueEudiCredentials', () => {
    beforeEach(() => {
      process.env.CLUSTER_REGION = Region.EU;
    });

    it('should issue multiple valid credentials', async () => {
      const requests: EudiCredentialRequest[] = [
        {
          credentialType: EudiCredentialType.MEDICAL_LICENSE,
          subjectDid: 'did:key:1',
          countryCode: 'DE',
          claims: {},
        },
        {
          credentialType: EudiCredentialType.NURSING_LICENSE,
          subjectDid: 'did:key:2',
          countryCode: 'FR',
          claims: {},
        },
      ];

      const { successful, failed } = await batchIssueEudiCredentials(requests);

      expect(successful).toHaveLength(2);
      expect(failed).toHaveLength(0);
    });

    it('should separate successful and failed issuances', async () => {
      const requests: EudiCredentialRequest[] = [
        {
          credentialType: EudiCredentialType.MEDICAL_LICENSE,
          subjectDid: 'did:key:1',
          countryCode: 'DE', // Valid
          claims: {},
        },
        {
          credentialType: EudiCredentialType.MEDICAL_LICENSE,
          subjectDid: 'did:key:2',
          countryCode: 'US', // Invalid - not EEA
          claims: {},
        },
        {
          credentialType: EudiCredentialType.NURSING_LICENSE,
          subjectDid: 'did:key:3',
          countryCode: 'FR', // Valid
          claims: {},
        },
      ];

      const { successful, failed } = await batchIssueEudiCredentials(requests);

      expect(successful).toHaveLength(2);
      expect(failed).toHaveLength(1);
      expect(failed[0].error.code).toBe('COUNTRY_NOT_ELIGIBLE');
    });
  });

  describe('getEudiAuditLogs', () => {
    beforeEach(() => {
      process.env.CLUSTER_REGION = Region.EU;
    });

    it('should filter logs by allowed status', async () => {
      await issueEudiCredential({
        credentialType: EudiCredentialType.MEDICAL_LICENSE,
        subjectDid: 'did:key:1',
        countryCode: 'DE',
        claims: {},
      });

      try {
        await issueEudiCredential({
          credentialType: EudiCredentialType.MEDICAL_LICENSE,
          subjectDid: 'did:key:2',
          countryCode: 'US',
          claims: {},
        });
      } catch (e) {
        // Expected
      }

      const successLogs = getEudiAuditLogs({ allowed: true });
      const failedLogs = getEudiAuditLogs({ allowed: false });

      expect(successLogs).toHaveLength(1);
      expect(failedLogs).toHaveLength(1);
    });

    it('should filter logs by country code', async () => {
      await issueEudiCredential({
        credentialType: EudiCredentialType.MEDICAL_LICENSE,
        subjectDid: 'did:key:1',
        countryCode: 'DE',
        claims: {},
      });

      await issueEudiCredential({
        credentialType: EudiCredentialType.MEDICAL_LICENSE,
        subjectDid: 'did:key:2',
        countryCode: 'FR',
        claims: {},
      });

      const deLogs = getEudiAuditLogs({ countryCode: 'DE' });
      const frLogs = getEudiAuditLogs({ countryCode: 'FR' });

      expect(deLogs).toHaveLength(1);
      expect(frLogs).toHaveLength(1);
    });

    it('should filter logs by credential type', async () => {
      await issueEudiCredential({
        credentialType: EudiCredentialType.MEDICAL_LICENSE,
        subjectDid: 'did:key:1',
        countryCode: 'DE',
        claims: {},
      });

      await issueEudiCredential({
        credentialType: EudiCredentialType.NURSING_LICENSE,
        subjectDid: 'did:key:2',
        countryCode: 'FR',
        claims: {},
      });

      const medicalLogs = getEudiAuditLogs({
        credentialType: EudiCredentialType.MEDICAL_LICENSE,
      });

      const nursingLogs = getEudiAuditLogs({
        credentialType: EudiCredentialType.NURSING_LICENSE,
      });

      expect(medicalLogs).toHaveLength(1);
      expect(nursingLogs).toHaveLength(1);
    });
  });

  describe('getEudiIssuanceMetrics', () => {
    beforeEach(() => {
      process.env.CLUSTER_REGION = Region.EU;
    });

    it('should calculate correct metrics', async () => {
      // Successful issuances
      await issueEudiCredential({
        credentialType: EudiCredentialType.MEDICAL_LICENSE,
        subjectDid: 'did:key:1',
        countryCode: 'DE',
        claims: {},
      });

      await issueEudiCredential({
        credentialType: EudiCredentialType.NURSING_LICENSE,
        subjectDid: 'did:key:2',
        countryCode: 'FR',
        claims: {},
      });

      // Failed issuance
      try {
        await issueEudiCredential({
          credentialType: EudiCredentialType.MEDICAL_LICENSE,
          subjectDid: 'did:key:3',
          countryCode: 'US',
          claims: {},
        });
      } catch (e) {
        // Expected
      }

      const metrics = getEudiIssuanceMetrics();

      expect(metrics.totalRequests).toBe(3);
      expect(metrics.successful).toBe(2);
      expect(metrics.failed).toBe(1);
      expect(metrics.byCountry['DE'].successful).toBe(1);
      expect(metrics.byCountry['FR'].successful).toBe(1);
      expect(metrics.byCountry['US'].failed).toBe(1);
    });
  });

  describe('isEudiIssuanceAvailable', () => {
    it('should return true in EU region', () => {
      process.env.CLUSTER_REGION = Region.EU;

      expect(isEudiIssuanceAvailable()).toBe(true);
    });

    it('should return false in US region', () => {
      process.env.CLUSTER_REGION = Region.US;

      expect(isEudiIssuanceAvailable()).toBe(false);
    });

    it('should return false in AU region', () => {
      process.env.CLUSTER_REGION = Region.AU;

      expect(isEudiIssuanceAvailable()).toBe(false);
    });
  });

  describe('getCurrentRegion', () => {
    it('should return current cluster region', () => {
      process.env.CLUSTER_REGION = Region.EU;

      expect(getCurrentRegion()).toBe(Region.EU);
    });
  });

  describe('EudiIssuanceError', () => {
    it('should serialize to JSON correctly', () => {
      const error = new EudiIssuanceError('Test error', 'TEST_CODE', Region.US, 'DE');

      const json = error.toJSON();

      expect(json.error).toBe('Test error');
      expect(json.code).toBe('TEST_CODE');
      expect(json.region).toBe(Region.US);
      expect(json.countryCode).toBe('DE');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete workflow in EU region', async () => {
      process.env.CLUSTER_REGION = Region.EU;

      const request: EudiCredentialRequest = {
        credentialType: EudiCredentialType.MEDICAL_LICENSE,
        subjectDid: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        countryCode: 'DE',
        claims: {
          licenseNumber: 'DE-12345',
          specialty: 'Cardiology',
          issuingAuthority: 'German Medical Association',
          issueDate: '2020-01-15',
        },
        validityPeriod: {
          notAfter: new Date('2025-12-31'),
        },
      };

      const response = await issueEudiCredential(request);

      expect(response.credential).toBeDefined();
      expect(response.credentialType).toBe(EudiCredentialType.MEDICAL_LICENSE);
      expect(response.format).toBe('vc+sd-jwt');

      const logs = getEudiAuditLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].allowed).toBe(true);
    });

    it('should reject workflow in US region', async () => {
      process.env.CLUSTER_REGION = Region.US;

      const request: EudiCredentialRequest = {
        credentialType: EudiCredentialType.MEDICAL_LICENSE,
        subjectDid: 'did:key:test',
        countryCode: 'DE',
        claims: {},
      };

      await expect(issueEudiCredential(request)).rejects.toThrow(/can only be issued in EU region/);

      const logs = getEudiAuditLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].allowed).toBe(false);
      expect(logs[0].currentRegion).toBe(Region.US);
    });
  });
});
