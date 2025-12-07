/**
 * B224A-REP-001: Tests for ClinicianReputation model
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import {
  getOrCreateReputation,
  updateReputation,
  getReputation,
  getReputations,
} from '../ClinicianReputation.js';

const prisma = new PrismaClient();

describe('ClinicianReputation', () => {
  const testClinicianId = 'test-clinician-123';

  beforeEach(async () => {
    // Clean up test data
    await prisma.clinicianReputation.deleteMany({
      where: { clinicianId: testClinicianId },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.clinicianReputation.deleteMany({
      where: { clinicianId: testClinicianId },
    });
  });

  describe('getOrCreateReputation', () => {
    it('should create a new reputation record if it does not exist', async () => {
      const reputation = await getOrCreateReputation(testClinicianId);

      expect(reputation.clinicianId).toBe(testClinicianId);
      expect(reputation.overallScore).toBe(0);
      expect(reputation.qualityScore).toBe(0);
      expect(reputation.credentialScore).toBe(0);
      expect(reputation.enrollmentScore).toBe(0);
      expect(reputation.peerReviewsScore).toBe(0);
    });

    it('should return existing reputation if it exists', async () => {
      // Create initial reputation
      await prisma.clinicianReputation.create({
        data: {
          clinicianId: testClinicianId,
          overallScore: 85,
          qualityScore: 90,
          credentialScore: 80,
          enrollmentScore: 75,
          peerReviewsScore: 88,
        },
      });

      const reputation = await getOrCreateReputation(testClinicianId);

      expect(reputation.clinicianId).toBe(testClinicianId);
      expect(reputation.overallScore).toBe(85);
      expect(reputation.qualityScore).toBe(90);
      expect(reputation.credentialScore).toBe(80);
      expect(reputation.enrollmentScore).toBe(75);
      expect(reputation.peerReviewsScore).toBe(88);
    });
  });

  describe('updateReputation', () => {
    it('should create reputation if it does not exist', async () => {
      const updated = await updateReputation(testClinicianId, {
        overallScore: 90,
        qualityScore: 95,
      });

      expect(updated.clinicianId).toBe(testClinicianId);
      expect(updated.overallScore).toBe(90);
      expect(updated.qualityScore).toBe(95);
      expect(updated.credentialScore).toBe(0);
      expect(updated.enrollmentScore).toBe(0);
      expect(updated.peerReviewsScore).toBe(0);
    });

    it('should update existing reputation', async () => {
      // Create initial reputation
      await prisma.clinicianReputation.create({
        data: {
          clinicianId: testClinicianId,
          overallScore: 50,
          qualityScore: 60,
          credentialScore: 70,
          enrollmentScore: 80,
          peerReviewsScore: 90,
        },
      });

      const updated = await updateReputation(testClinicianId, {
        overallScore: 85,
        qualityScore: 88,
      });

      expect(updated.overallScore).toBe(85);
      expect(updated.qualityScore).toBe(88);
      expect(updated.credentialScore).toBe(70); // Unchanged
      expect(updated.enrollmentScore).toBe(80); // Unchanged
      expect(updated.peerReviewsScore).toBe(90); // Unchanged
    });
  });

  describe('getReputation', () => {
    it('should return null if reputation does not exist', async () => {
      const reputation = await getReputation(testClinicianId);
      expect(reputation).toBeNull();
    });

    it('should return reputation if it exists', async () => {
      await prisma.clinicianReputation.create({
        data: {
          clinicianId: testClinicianId,
          overallScore: 85,
          qualityScore: 90,
          credentialScore: 80,
          enrollmentScore: 75,
          peerReviewsScore: 88,
        },
      });

      const reputation = await getReputation(testClinicianId);
      expect(reputation).not.toBeNull();
      expect(reputation?.overallScore).toBe(85);
    });
  });

  describe('getReputations', () => {
    it('should return map of reputations for multiple clinicians', async () => {
      const clinicianIds = ['clinician-1', 'clinician-2', 'clinician-3'];

      // Create test reputations
      await prisma.clinicianReputation.createMany({
        data: [
          {
            clinicianId: 'clinician-1',
            overallScore: 85,
            qualityScore: 90,
            credentialScore: 80,
            enrollmentScore: 75,
            peerReviewsScore: 88,
          },
          {
            clinicianId: 'clinician-2',
            overallScore: 75,
            qualityScore: 80,
            credentialScore: 70,
            enrollmentScore: 65,
            peerReviewsScore: 78,
          },
        ],
      });

      const reputations = await getReputations(clinicianIds);

      expect(reputations.size).toBe(2);
      expect(reputations.get('clinician-1')?.overallScore).toBe(85);
      expect(reputations.get('clinician-2')?.overallScore).toBe(75);
      expect(reputations.get('clinician-3')).toBeUndefined();

      // Cleanup
      await prisma.clinicianReputation.deleteMany({
        where: { clinicianId: { in: clinicianIds } },
      });
    });
  });
});

