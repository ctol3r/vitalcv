/**
 * Tests for FeatureExtractor service
 * Tests extraction for 3 clinicians as specified in acceptance criteria
 */

import { describe, it, expect } from '@jest/globals';
import { FeatureExtractor } from '../featureExtractor.js';
import type {
  OPPEData,
  FPPEData,
  DriftData,
  ComplianceData,
  EnrollmentData,
  RiskData,
  EHRData,
} from '../featureExtractor.js';

describe('FeatureExtractor', () => {
  const extractor = new FeatureExtractor();

  describe('Clinician 1: High-performing clinician', () => {
    it('should extract features for high-performing clinician', async () => {
      const data = {
        oppe: {
          trend: 0.8,
          lastReviewScore: 0.9,
          caseCount: 50,
          complications: 2,
        } as OPPEData,
        fppe: {
          status: 'COMPLETED',
          outcomes: 0.95,
        } as FPPEData,
        drift: [] as DriftData[],
        compliance: {
          licenseExpiryDays: 1000,
          boardExpiryDays: 800,
          deaExpiryDays: 600,
          pecosStatus: 'ENROLLED',
        } as ComplianceData,
        enrollment: {
          payerDenialRate: 0.02,
          enrollmentDecline: 0.0,
        } as EnrollmentData,
        risk: {
          complicationRate: 0.05,
          riskScore: 0.1,
        } as RiskData,
        ehr: {
          mismatchCount: 0,
        } as EHRData,
      };

      const features = await extractor.extractFeatures(
        { clinicianId: 'clinician-1' },
        data
      );

      expect(features.oppe_trend).toBeGreaterThan(0.5);
      expect(features.fppe_outcomes).toBeGreaterThan(0.8);
      expect(features.complication_rate).toBeLessThan(0.2);
      expect(features.drift_events).toBe(0);
      expect(features.license_freshness).toBeGreaterThan(0.5);
      expect(features.pecos_status).toBe(1.0);
      expect(features.payer_denials).toBeLessThan(0.1);
      expect(features.ehr_mismatches).toBe(0);
    });
  });

  describe('Clinician 2: At-risk clinician', () => {
    it('should extract features for at-risk clinician', async () => {
      const data = {
        oppe: {
          trend: -0.3,
          lastReviewScore: 0.6,
          caseCount: 30,
          complications: 5,
        } as OPPEData,
        fppe: {
          status: 'OPEN',
          outcomes: 0.6,
        } as FPPEData,
        drift: [
          {
            eventCount: 1,
            severity: 'MED',
            lastEventAt: new Date(),
          },
        ] as DriftData[],
        compliance: {
          licenseExpiryDays: 90,
          boardExpiryDays: 60,
          deaExpiryDays: 120,
          pecosStatus: 'PENDING',
        } as ComplianceData,
        enrollment: {
          payerDenialRate: 0.15,
          enrollmentDecline: 0.3,
        } as EnrollmentData,
        risk: {
          complicationRate: 0.25,
          riskScore: 0.5,
        } as RiskData,
        ehr: {
          mismatchCount: 2,
        } as EHRData,
      };

      const features = await extractor.extractFeatures(
        { clinicianId: 'clinician-2' },
        data
      );

      expect(features.oppe_trend).toBeLessThan(0);
      expect(features.fppe_outcomes).toBeLessThan(0.7);
      expect(features.complication_rate).toBeGreaterThan(0.2);
      expect(features.drift_events).toBeGreaterThan(0);
      expect(features.license_freshness).toBeLessThan(0.3);
      expect(features.pecos_status).toBe(0.5);
      expect(features.payer_denials).toBeGreaterThan(0.1);
      expect(features.ehr_mismatches).toBeGreaterThan(0);
    });
  });

  describe('Clinician 3: High-risk clinician', () => {
    it('should extract features for high-risk clinician', async () => {
      const data = {
        oppe: {
          trend: -0.8,
          lastReviewScore: 0.4,
          caseCount: 20,
          complications: 8,
        } as OPPEData,
        fppe: {
          status: 'CANCELLED',
          outcomes: 0.3,
        } as FPPEData,
        drift: [
          {
            eventCount: 1,
            severity: 'HIGH',
            lastEventAt: new Date(),
          },
          {
            eventCount: 1,
            severity: 'CRITICAL',
            lastEventAt: new Date(),
          },
        ] as DriftData[],
        compliance: {
          licenseExpiryDays: -30, // Expired
          boardExpiryDays: -60, // Expired
          deaExpiryDays: 10,
          pecosStatus: 'DEACTIVATED',
        } as ComplianceData,
        enrollment: {
          payerDenialRate: 0.4,
          enrollmentDecline: 0.6,
        } as EnrollmentData,
        risk: {
          complicationRate: 0.6,
          riskScore: 0.8,
        } as RiskData,
        ehr: {
          mismatchCount: 5,
        } as EHRData,
      };

      const features = await extractor.extractFeatures(
        { clinicianId: 'clinician-3' },
        data
      );

      expect(features.oppe_trend).toBeLessThan(-0.5);
      expect(features.fppe_outcomes).toBeLessThan(0.5);
      expect(features.complication_rate).toBeGreaterThan(0.5);
      expect(features.drift_events).toBeGreaterThan(0.3);
      expect(features.license_freshness).toBe(0); // Expired
      expect(features.board_freshness).toBe(0); // Expired
      expect(features.pecos_status).toBe(0);
      expect(features.payer_denials).toBeGreaterThan(0.3);
      expect(features.ehr_mismatches).toBeGreaterThan(0.5);
    });
  });

  describe('Edge cases', () => {
    it('should handle missing data gracefully', async () => {
      const features = await extractor.extractFeatures(
        { clinicianId: 'clinician-empty' },
        {}
      );

      // Should have default/neutral values
      expect(features.oppe_trend).toBe(0);
      expect(features.fppe_outcomes).toBe(0.5);
      expect(features.complication_rate).toBe(0);
      expect(features.drift_events).toBe(0);
      expect(features.pecos_status).toBe(0);
    });

    it('should create feature vector', () => {
      const features = {
        oppe_trend: 0.5,
        fppe_outcomes: 0.8,
        complication_rate: 0.2,
        drift_events: 0.1,
        license_freshness: 0.9,
        board_freshness: 0.85,
        dea_expiry: 0.95,
        pecos_status: 1.0,
        payer_denials: 0.05,
        ehr_mismatches: 0.0,
      };

      const vector = extractor.createFeatureVector('clinician-1', features);
      expect(vector.clinicianId).toBe('clinician-1');
      expect(vector.features).toEqual(features);
      expect(vector.timestamp).toBeInstanceOf(Date);
    });
  });
});

