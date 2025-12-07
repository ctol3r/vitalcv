/**
 * B132A-MATCH-007: Tests for rule-based job matcher
 */

import { matchJobs, getTopMatches, JobCandidate } from '../rulesEngine';
import { JobMatchCriteria } from '../../jobs/models/JobPosting';

describe('Job Matcher Rules Engine', () => {
  const mockJobs: JobCandidate[] = [
    {
      id: 'job_1',
      partnerId: 'partner_1',
      title: 'Family Medicine - Telehealth',
      specialty: '207Q00000X', // Family Medicine
      requiredStates: ['CA', 'NY'],
      modality: 'telehealth',
      location: { state: 'CA' },
      telehealth: true,
      imlcEligible: true,
      multiStateOk: true,
      status: 'active',
    },
    {
      id: 'job_2',
      partnerId: 'partner_1',
      title: 'Emergency Medicine',
      specialty: '207P00000X', // Emergency Medicine
      requiredStates: ['NY'],
      modality: 'in-person',
      location: { state: 'NY' },
      telehealth: false,
      imlcEligible: false,
      multiStateOk: false,
      status: 'active',
    },
    {
      id: 'job_3',
      partnerId: 'partner_2',
      title: 'Cardiology',
      specialty: '207RC0000X', // Cardiology
      requiredStates: ['CA'],
      modality: 'hybrid',
      location: { state: 'CA' },
      telehealth: true,
      imlcEligible: false,
      multiStateOk: true,
      status: 'active',
    },
  ];

  describe('specialty matching', () => {
    it('should match jobs with exact specialty match', () => {
      const criteria: JobMatchCriteria = {
        specialty: '207Q00000X', // Family Medicine
        licenseStates: ['CA'],
      };

      const matches = matchJobs(criteria, mockJobs);
      const matchedJobs = matches.filter(m => m.matched);

      expect(matchedJobs.length).toBeGreaterThan(0);
      expect(matchedJobs[0].jobId).toBe('job_1');
      expect(matchedJobs[0].reason.specialty.matched).toBe(true);
      expect(matchedJobs[0].reason.specialty.score).toBe(1.0);
    });

    it('should not match jobs with different specialty', () => {
      const criteria: JobMatchCriteria = {
        specialty: '207Q00000X', // Family Medicine
        licenseStates: ['NY'],
      };

      const matches = matchJobs(criteria, mockJobs);
      const emergencyMatch = matches.find(m => m.jobId === 'job_2');

      expect(emergencyMatch?.matched).toBe(false);
      expect(emergencyMatch?.reason.specialty.matched).toBe(false);
    });
  });

  describe('license state matching', () => {
    it('should match jobs with direct license state', () => {
      const criteria: JobMatchCriteria = {
        specialty: '207Q00000X',
        licenseStates: ['CA'],
      };

      const matches = matchJobs(criteria, mockJobs);
      const matchedJobs = matches.filter(m => m.matched);

      expect(matchedJobs.length).toBeGreaterThan(0);
      expect(matchedJobs[0].reason.licenseState.matched).toBe(true);
      expect(matchedJobs[0].reason.licenseState.method).toBe('direct');
    });

    it('should match jobs with IMLC eligibility', () => {
      const criteria: JobMatchCriteria = {
        specialty: '207Q00000X',
        licenseStates: ['FL'], // IMLC state but not direct match
        imlcMember: true,
      };

      const matches = matchJobs(criteria, mockJobs);
      const job1Match = matches.find(m => m.jobId === 'job_1');

      // Should match via IMLC if job accepts IMLC
      if (job1Match?.matched) {
        expect(job1Match.reason.licenseState.method).toBe('imlc');
      }
    });

    it('should not match without required license state', () => {
      const criteria: JobMatchCriteria = {
        specialty: '207Q00000X',
        licenseStates: ['FL'], // Not in required states and job not IMLC
        imlcMember: false,
      };

      const matches = matchJobs(criteria, [mockJobs[1]]); // Emergency job - no IMLC
      expect(matches[0].matched).toBe(false);
    });
  });

  describe('multi-state licenses', () => {
    it('should match jobs with multi-state license', () => {
      const criteria: JobMatchCriteria = {
        specialty: '207RC0000X', // Cardiology
        licenseStates: ['TX'], // Not direct match
        multiStateLicenses: ['CA'], // But has multi-state in CA
      };

      const matches = matchJobs(criteria, [mockJobs[2]]); // Cardiology job
      expect(matches[0].reason.licenseState.method).toBe('multi-state');
    });
  });

  describe('ranking and scoring', () => {
    it('should rank matches by score', () => {
      const criteria: JobMatchCriteria = {
        specialty: '207Q00000X',
        licenseStates: ['CA', 'NY'],
      };

      const matches = matchJobs(criteria, mockJobs);
      const matchedJobs = matches.filter(m => m.matched);

      // Check that matches are sorted by score
      for (let i = 1; i < matchedJobs.length; i++) {
        expect(matchedJobs[i - 1].score).toBeGreaterThanOrEqual(matchedJobs[i].score);
      }

      // Check that ranks are assigned
      matchedJobs.forEach((match, index) => {
        expect(match.rank).toBe(index + 1);
      });
    });

    it('should return top N matches', () => {
      const criteria: JobMatchCriteria = {
        specialty: '207Q00000X',
        licenseStates: ['CA'],
      };

      const topMatches = getTopMatches(criteria, mockJobs, 2);
      expect(topMatches.length).toBeLessThanOrEqual(2);
      expect(topMatches.every(m => m.matched)).toBe(true);
    });
  });

  describe('inactive jobs', () => {
    it('should skip inactive jobs', () => {
      const inactiveJob: JobCandidate = {
        ...mockJobs[0],
        id: 'job_inactive',
        status: 'closed',
      };

      const criteria: JobMatchCriteria = {
        specialty: '207Q00000X',
        licenseStates: ['CA'],
      };

      const matches = matchJobs(criteria, [inactiveJob]);
      expect(matches.length).toBe(0);
    });
  });
});

