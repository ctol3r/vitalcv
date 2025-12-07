/**
 * Tests for CompetencyFeatureExtractor
 */

import { describe, it, expect } from '@jest/globals';
import { CompetencyFeatureExtractor } from '../featureExtractor.js';
import type {
  OPPEData,
  FPPEData,
  FusionData,
  DriftData,
  MobilityData,
  CredentialData,
  SafetyData,
} from '../featureExtractor.js';
import type { ProcedureCase } from '../caseComplexity.js';
import type { PrivilegeNode } from '../privilegeBreadthDepth.js';
import type { PECOSEnrollment, PayerEnrollment } from '../enrollmentCompleteness.js';

describe('CompetencyFeatureExtractor', () => {
  const extractor = new CompetencyFeatureExtractor();

  describe('Deterministic mode', () => {
    it('should extract features in deterministic mode', async () => {
      const features = await extractor.extractFeatures(
        { clinicianId: 'clinician-1', deterministic: true },
        {
          oppe: {
            trend: 0.5,
            caseCount: 100,
            complications: 5,
          } as OPPEData,
          fppe: {
            status: 'COMPLETED',
            score: 0.9,
          } as FPPEData,
        }
      );

      // In deterministic mode, forecastRisk should be neutral (0.5) if no fusion/safety data
      expect(features.forecastRisk).toBe(0.5);
      expect(features.caseVolume).toBeGreaterThan(0);
      expect(features.FPPE_score).toBe(0.9);
    });
  });

  describe('Feature extraction', () => {
    it('should extract all features from complete data', async () => {
      const features = await extractor.extractFeatures(
        { clinicianId: 'clinician-1' },
        {
          oppe: {
            trend: 0.8,
            caseCount: 200,
            complications: 3,
          } as OPPEData,
          fppe: {
            status: 'COMPLETED',
            score: 0.95,
          } as FPPEData,
          fusion: {
            qualityScore: 0.9,
            safetyScore: 0.2,
          } as FusionData,
          drift: [] as DriftData[],
          mobility: {
            compactEligible: true,
            eligibleStates: ['CA', 'NY', 'TX'],
            activeStates: ['CA', 'NY'],
          } as MobilityData,
          enrollment: {
            pecos: {
              status: 'ENROLLED',
            } as PECOSEnrollment,
            payers: [
              {
                payerId: 'payer-1',
                payerName: 'Medicare',
                status: 'ENROLLED',
                isRequired: true,
              } as PayerEnrollment,
            ],
          },
          privileges: [
            {
              privilegeCode: 'PRIV-001',
              category: 'surgical',
              dependencies: [],
            } as PrivilegeNode,
          ],
          procedures: [
            {
              privilegeCode: 'PRIV-001',
              category: 'surgical',
              caseCount: 50,
              complicationCount: 2,
            } as ProcedureCase,
          ],
          credentials: {
            licenseExpiryDays: 1000,
            boardExpiryDays: 800,
            boardCertificationDate: new Date('2020-01-01'),
            trainingStartDate: new Date('2010-01-01'),
          } as CredentialData,
          safety: {
            eventCount: 0,
          } as SafetyData,
        }
      );

      expect(features.caseVolume).toBeGreaterThan(0);
      expect(features.caseComplexityIndex).toBeGreaterThanOrEqual(0);
      expect(features.complicationRate).toBeGreaterThanOrEqual(0);
      expect(features.FPPE_score).toBe(0.95);
      expect(features.OPPE_trend).toBe(0.8);
      expect(features.credentialFreshness).toBeGreaterThan(0.5);
      expect(features.privilegeDepth).toBeGreaterThanOrEqual(0);
      expect(features.privilegeBreadth).toBeGreaterThan(0);
      expect(features.enrollmentCompleteness).toBeGreaterThan(0);
      expect(features.mobilityReadiness).toBeGreaterThan(0);
      expect(features.safetyHistory).toBe(1.0); // No events = excellent
      expect(features.driftHistory).toBe(0); // No drift
      expect(features.forecastRisk).toBe(0.2); // From fusion safetyScore
      expect(features.trainingYears).toBeGreaterThan(0);
      expect(features.boardRecency).toBeGreaterThan(0);
    });

    it('should handle missing data gracefully', async () => {
      const features = await extractor.extractFeatures(
        { clinicianId: 'clinician-empty' },
        {}
      );

      // Should have default/neutral values
      expect(features.caseVolume).toBe(0);
      expect(features.caseComplexityIndex).toBe(0);
      expect(features.complicationRate).toBe(0);
      expect(features.FPPE_score).toBe(0.5);
      expect(features.OPPE_trend).toBe(0);
      expect(features.credentialFreshness).toBe(0.5);
      expect(features.privilegeDepth).toBe(0);
      expect(features.privilegeBreadth).toBe(0);
      expect(features.enrollmentCompleteness).toBe(0);
      expect(features.mobilityReadiness).toBe(0);
      expect(features.safetyHistory).toBe(1.0); // No events = excellent
      expect(features.driftHistory).toBe(0);
      expect(features.forecastRisk).toBe(0.2); // Default low risk
      expect(features.trainingYears).toBe(0.5);
      expect(features.boardRecency).toBe(0.5);
    });
  });

  describe('createFeatureVector', () => {
    it('should create a feature vector', () => {
      const features = {
        caseVolume: 0.8,
        caseComplexityIndex: 0.6,
        complicationRate: 0.1,
        FPPE_score: 0.9,
        OPPE_trend: 0.5,
        credentialFreshness: 0.85,
        privilegeDepth: 0.4,
        privilegeBreadth: 0.7,
        enrollmentCompleteness: 0.9,
        mobilityReadiness: 0.6,
        safetyHistory: 0.95,
        driftHistory: 0.1,
        forecastRisk: 0.2,
        trainingYears: 0.75,
        boardRecency: 0.8,
      };

      const vector = extractor.createFeatureVector('clinician-1', features);
      expect(vector.clinicianId).toBe('clinician-1');
      expect(vector.features).toEqual(features);
      expect(vector.timestamp).toBeInstanceOf(Date);
    });
  });
});

