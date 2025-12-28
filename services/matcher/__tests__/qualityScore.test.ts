/**
 * B145B-AN-002: Unit tests for match quality score computation
 */

import {
  computeQualityScore,
  computeDistanceScore,
  computeSpecialtyScore,
  computeCompactScore,
  calculateDistance,
  SCORE_WEIGHTS,
  ClinicianProfile,
  JobRequirements,
} from '../qualityScore';

describe('Match Quality Score Computation', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two coordinates', () => {
      // New York to Los Angeles (approx 2451 miles)
      const distance = calculateDistance(40.7128, -74.006, 34.0522, -118.2437);
      expect(distance).toBeGreaterThan(2400);
      expect(distance).toBeLessThan(2500);
    });

    it('should return 0 for same coordinates', () => {
      const distance = calculateDistance(40.7128, -74.006, 40.7128, -74.006);
      expect(distance).toBeCloseTo(0, 1);
    });

    it('should calculate short distances accurately', () => {
      // Short distance test (approx 10 miles)
      const distance = calculateDistance(40.7128, -74.006, 40.8128, -73.906);
      expect(distance).toBeGreaterThan(5);
      expect(distance).toBeLessThan(15);
    });
  });

  describe('computeDistanceScore', () => {
    const clinician: ClinicianProfile = {
      did: 'did:example:123',
      specialty: '207R00000X',
      licenseStates: ['NY'],
      homeLocation: {
        lat: 40.7128,
        lng: -74.006,
        state: 'NY',
      },
    };

    it('should give max score for telehealth jobs', () => {
      const job: JobRequirements = {
        jobId: 'job1',
        specialty: '207R00000X',
        requiredStates: ['CA'],
        modality: 'telehealth',
      };

      const result = computeDistanceScore(clinician, job);
      expect(result.score).toBe(100);
      expect(result.distanceMiles).toBeUndefined();
    });

    it('should give high score for local jobs (< 25 miles)', () => {
      const job: JobRequirements = {
        jobId: 'job1',
        specialty: '207R00000X',
        requiredStates: ['NY'],
        modality: 'in-person',
        location: {
          lat: 40.8128,
          lng: -73.906,
          state: 'NY',
        },
      };

      const result = computeDistanceScore(clinician, job);
      expect(result.score).toBe(100);
      expect(result.distanceMiles).toBeDefined();
      expect(result.distanceMiles!).toBeLessThan(25);
    });

    it('should give medium score for regional jobs (25-100 miles)', () => {
      const job: JobRequirements = {
        jobId: 'job1',
        specialty: '207R00000X',
        requiredStates: ['NY'],
        modality: 'in-person',
        location: {
          lat: 41.7128,
          lng: -73.006,
          state: 'NY',
        },
      };

      const result = computeDistanceScore(clinician, job);
      expect(result.score).toBe(80);
      expect(result.distanceMiles).toBeDefined();
    });

    it('should give neutral score when location is missing', () => {
      const clinicianNoLocation = { ...clinician, homeLocation: undefined };
      const job: JobRequirements = {
        jobId: 'job1',
        specialty: '207R00000X',
        requiredStates: ['NY'],
        modality: 'in-person',
      };

      const result = computeDistanceScore(clinicianNoLocation, job);
      expect(result.score).toBe(50);
    });
  });

  describe('computeSpecialtyScore', () => {
    it('should give perfect score for exact match', () => {
      const result = computeSpecialtyScore('207R00000X', '207R00000X');
      expect(result.score).toBe(100);
      expect(result.match).toBe('exact');
    });

    it('should give high score for category match', () => {
      const result = computeSpecialtyScore('207R00000X', '207R12345X');
      expect(result.score).toBe(80);
      expect(result.match).toBe('category');
    });

    it('should give medium score for group match', () => {
      const result = computeSpecialtyScore('207R00000X', '208R00000X');
      expect(result.score).toBe(50);
      expect(result.match).toBe('group');
    });

    it('should give zero score for no match', () => {
      const result = computeSpecialtyScore('207R00000X', '103T00000X');
      expect(result.score).toBe(0);
      expect(result.match).toBe('none');
    });

    it('should handle empty specialties', () => {
      const result = computeSpecialtyScore('', '207R00000X');
      expect(result.score).toBe(0);
      expect(result.match).toBe('none');
    });
  });

  describe('computeCompactScore', () => {
    it('should give perfect score for direct license', () => {
      const clinician: ClinicianProfile = {
        did: 'did:example:123',
        specialty: '207R00000X',
        licenseStates: ['NY', 'CA'],
      };

      const job: JobRequirements = {
        jobId: 'job1',
        specialty: '207R00000X',
        requiredStates: ['CA'],
        modality: 'in-person',
      };

      const result = computeCompactScore(clinician, job);
      expect(result.score).toBe(100);
      expect(result.eligibility).toContain('direct_license');
    });

    it('should give high score for compact eligibility', () => {
      const clinician: ClinicianProfile = {
        did: 'did:example:123',
        specialty: '207R00000X',
        licenseStates: ['NY'],
        compacts: {
          imlc: true,
        },
      };

      const job: JobRequirements = {
        jobId: 'job1',
        specialty: '207R00000X',
        requiredStates: ['CA'],
        modality: 'telehealth',
        compacts: {
          imlcAllowed: true,
        },
      };

      const result = computeCompactScore(clinician, job);
      expect(result.score).toBe(90);
      expect(result.eligibility).toContain('imlc');
      expect(result.eligibility).toContain('imlc_portable');
    });

    it('should give zero score for no eligibility', () => {
      const clinician: ClinicianProfile = {
        did: 'did:example:123',
        specialty: '207R00000X',
        licenseStates: ['NY'],
      };

      const job: JobRequirements = {
        jobId: 'job1',
        specialty: '207R00000X',
        requiredStates: ['CA'],
        modality: 'in-person',
      };

      const result = computeCompactScore(clinician, job);
      expect(result.score).toBe(0);
      expect(result.eligibility).toHaveLength(0);
    });

    it('should recognize multiple compact types', () => {
      const clinician: ClinicianProfile = {
        did: 'did:example:123',
        specialty: '207R00000X',
        licenseStates: ['NY'],
        compacts: {
          imlc: true,
          psypact: true,
        },
      };

      const job: JobRequirements = {
        jobId: 'job1',
        specialty: '207R00000X',
        requiredStates: ['CA'],
        modality: 'telehealth',
        compacts: {
          imlcAllowed: true,
          psypactAllowed: true,
        },
      };

      const result = computeCompactScore(clinician, job);
      expect(result.eligibility).toContain('imlc');
      expect(result.eligibility).toContain('psypact');
    });
  });

  describe('computeQualityScore', () => {
    it('should compute overall quality score with correct weights', () => {
      const clinician: ClinicianProfile = {
        did: 'did:example:123',
        specialty: '207R00000X',
        licenseStates: ['NY', 'CA'],
        homeLocation: {
          lat: 40.7128,
          lng: -74.006,
          state: 'NY',
        },
      };

      const job: JobRequirements = {
        jobId: 'job1',
        specialty: '207R00000X',
        requiredStates: ['CA'],
        modality: 'telehealth',
      };

      const score = computeQualityScore(clinician, job);

      // Telehealth (distance=100), exact specialty (100), direct license (100)
      const expectedScore =
        100 * SCORE_WEIGHTS.DISTANCE +
        100 * SCORE_WEIGHTS.SPECIALTY +
        100 * SCORE_WEIGHTS.COMPACT;

      expect(score.overallScore).toBeCloseTo(expectedScore, 2);
      expect(score.distanceScore).toBe(100);
      expect(score.specialtyScore).toBe(100);
      expect(score.compactScore).toBe(100);
    });

    it('should include feature breakdown', () => {
      const clinician: ClinicianProfile = {
        did: 'did:example:123',
        specialty: '207R00000X',
        licenseStates: ['NY'],
        homeLocation: {
          lat: 40.7128,
          lng: -74.006,
          state: 'NY',
        },
        compacts: {
          imlc: true,
        },
      };

      const job: JobRequirements = {
        jobId: 'job1',
        specialty: '207R12345X', // Category match
        requiredStates: ['CA'],
        modality: 'in-person',
        location: {
          lat: 34.0522,
          lng: -118.2437,
          state: 'CA',
        },
        compacts: {
          imlcAllowed: true,
        },
      };

      const score = computeQualityScore(clinician, job);

      expect(score.features.specialtyMatch).toBe('category');
      expect(score.features.compactEligibility).toContain('imlc');
      expect(score.features.distanceMiles).toBeGreaterThan(2400);
      expect(score.breakdown.distance.weight).toBe(SCORE_WEIGHTS.DISTANCE);
      expect(score.breakdown.specialty.weight).toBe(SCORE_WEIGHTS.SPECIALTY);
      expect(score.breakdown.compact.weight).toBe(SCORE_WEIGHTS.COMPACT);
    });

    it('should handle edge case: no location, no specialty match, no license', () => {
      const clinician: ClinicianProfile = {
        did: 'did:example:123',
        specialty: '103T00000X',
        licenseStates: ['NY'],
      };

      const job: JobRequirements = {
        jobId: 'job1',
        specialty: '207R00000X',
        requiredStates: ['CA'],
        modality: 'in-person',
      };

      const score = computeQualityScore(clinician, job);

      // Distance neutral (50), no specialty match (0), no compact (0)
      const expectedScore =
        50 * SCORE_WEIGHTS.DISTANCE +
        0 * SCORE_WEIGHTS.SPECIALTY +
        0 * SCORE_WEIGHTS.COMPACT;

      expect(score.overallScore).toBeCloseTo(expectedScore, 2);
      expect(score.overallScore).toBeLessThan(20); // Should be very low
    });

    it('should properly weight specialty higher than distance and compact', () => {
      // Since specialty weight is 0.5, it should dominate the score
      const clinician: ClinicianProfile = {
        did: 'did:example:123',
        specialty: '207R00000X',
        licenseStates: ['NY'],
      };

      const jobGoodSpecialty: JobRequirements = {
        jobId: 'job1',
        specialty: '207R00000X', // Exact match
        requiredStates: ['CA'],
        modality: 'in-person',
      };

      const jobBadSpecialty: JobRequirements = {
        jobId: 'job2',
        specialty: '103T00000X', // No match
        requiredStates: ['NY'],
        modality: 'in-person',
      };

      const score1 = computeQualityScore(clinician, jobGoodSpecialty);
      const score2 = computeQualityScore(clinician, jobBadSpecialty);

      expect(score1.overallScore).toBeGreaterThan(score2.overallScore);
      expect(score1.breakdown.specialty.contribution).toBeGreaterThan(
        score2.breakdown.specialty.contribution
      );
    });
  });

  describe('Score validation', () => {
    it('should ensure all component scores are between 0 and 100', () => {
      const clinician: ClinicianProfile = {
        did: 'did:example:123',
        specialty: '207R00000X',
        licenseStates: ['NY', 'CA'],
        homeLocation: {
          lat: 40.7128,
          lng: -74.006,
          state: 'NY',
        },
      };

      const job: JobRequirements = {
        jobId: 'job1',
        specialty: '207R00000X',
        requiredStates: ['CA'],
        modality: 'in-person',
        location: {
          lat: 34.0522,
          lng: -118.2437,
          state: 'CA',
        },
      };

      const score = computeQualityScore(clinician, job);

      expect(score.distanceScore).toBeGreaterThanOrEqual(0);
      expect(score.distanceScore).toBeLessThanOrEqual(100);
      expect(score.specialtyScore).toBeGreaterThanOrEqual(0);
      expect(score.specialtyScore).toBeLessThanOrEqual(100);
      expect(score.compactScore).toBeGreaterThanOrEqual(0);
      expect(score.compactScore).toBeLessThanOrEqual(100);
      expect(score.overallScore).toBeGreaterThanOrEqual(0);
      expect(score.overallScore).toBeLessThanOrEqual(100);
    });

    it('should ensure weights sum to 1', () => {
      const totalWeight =
        SCORE_WEIGHTS.DISTANCE +
        SCORE_WEIGHTS.SPECIALTY +
        SCORE_WEIGHTS.COMPACT;
      expect(totalWeight).toBeCloseTo(1.0, 10);
    });
  });
});
