/**
 * B132A-MATCH-008: Matcher API: /api/match/jobs for clinician DID
 *
 * Returns ranked jobs; includes reason codes; respects pagination
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { JobMatchCriteria } from '../../../../../services/jobs/models/JobPosting';
import { matchJobs, JobCandidate } from '../../../../../services/matcher/rulesEngine';
import { checkTelehealthEligibility, getTelehealthEligibilitySummary } from '../../../../../services/matcher/telemedRules';
import { logImpression } from '../../../../../services/matcher/impressions';

const router = Router();
const prisma = new PrismaClient();

// Match request schema
const MatchRequestSchema = z.object({
  did: z.string().min(1, 'Clinician DID is required'),
  specialty: z.string().min(1, 'Specialty is required'),
  licenseStates: z.array(z.string().length(2)).min(1, 'At least one license state required'),
  imlcMember: z.boolean().optional(),
  multiStateLicenses: z.array(z.string().length(2)).optional(),
  preferredModality: z.enum(['in-person', 'telehealth', 'hybrid']).optional(),
  location: z.object({
    state: z.string().length(2),
    maxDistance: z.number().optional(),
  }).optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});

// Mock job data (same as search API - in production, shared database)
const mockJobs: JobCandidate[] = [
  {
    id: 'job_1',
    partnerId: 'partner_1',
    title: 'Family Medicine Physician - Remote',
    specialty: '207Q00000X',
    requiredStates: ['CA', 'NY', 'TX'],
    modality: 'telehealth',
    location: { city: 'San Francisco', state: 'CA', zip: '94105' },
    telehealth: true,
    imlcEligible: true,
    multiStateOk: true,
    compRangeMin: 200000,
    compRangeMax: 300000,
    status: 'active',
  },
  {
    id: 'job_2',
    partnerId: 'partner_1',
    title: 'Emergency Medicine Physician',
    specialty: '207P00000X',
    requiredStates: ['NY'],
    modality: 'in-person',
    location: { city: 'New York', state: 'NY', zip: '10001' },
    telehealth: false,
    imlcEligible: false,
    multiStateOk: false,
    compRangeMin: 250000,
    compRangeMax: 350000,
    status: 'active',
  },
  {
    id: 'job_3',
    partnerId: 'partner_2',
    title: 'Cardiology - Hybrid Role',
    specialty: '207RC0000X',
    requiredStates: ['CA', 'NV'],
    modality: 'hybrid',
    location: { city: 'Los Angeles', state: 'CA', zip: '90001' },
    telehealth: true,
    imlcEligible: false,
    multiStateOk: true,
    compRangeMin: 300000,
    compRangeMax: 450000,
    status: 'active',
  },
];

/**
 * POST /api/match/jobs
 * Find matching jobs for a clinician
 */
router.post('/match/jobs', async (req: Request, res: Response) => {
  try {
    // Validate request
    const matchRequest = MatchRequestSchema.parse(req.body);

    // B146A-QA-002: Check if clinician profile exists
    const clinicianProfile = await prisma.user.findUnique({
      where: { did: matchRequest.did },
    });

    if (!clinicianProfile) {
      return res.status(400).json({
        errorCode: 'CLINICIAN_PROFILE_NOT_FOUND',
        message: `No clinician profile found for DID: ${matchRequest.did}`,
      });
    }

    // Build match criteria
    const criteria: JobMatchCriteria = {
      specialty: matchRequest.specialty,
      licenseStates: matchRequest.licenseStates,
      imlcMember: matchRequest.imlcMember,
      multiStateLicenses: matchRequest.multiStateLicenses,
      preferredModality: matchRequest.preferredModality,
      location: matchRequest.location,
    };

    // Run matcher
    const matches = matchJobs(criteria, mockJobs);

    // Filter to only matched jobs
    const matchedJobs = matches.filter(m => m.matched);

    // Apply pagination
    const total = matchedJobs.length;
    const limit = matchRequest.limit;
    const offset = matchRequest.offset;
    const paginatedMatches = matchedJobs.slice(offset, offset + limit);

    // Enhance results with job details and telehealth info
    const results = paginatedMatches.map(match => {
      const job = mockJobs.find(j => j.id === match.jobId);
      const telehealthInfo = job
        ? checkTelehealthEligibility(criteria, job.requiredStates)
        : null;

      return {
        jobId: match.jobId,
        job: job ? {
          title: job.title,
          specialty: job.specialty,
          requiredStates: job.requiredStates,
          modality: job.modality,
          location: job.location,
          compRange: job.compRangeMin && job.compRangeMax
            ? { min: job.compRangeMin, max: job.compRangeMax, currency: 'USD' }
            : undefined,
          telehealth: job.telehealth,
          imlcEligible: job.imlcEligible,
        } : undefined,
        matchScore: match.score,
        rank: match.rank,
        matchReason: match.reason,
        telehealthEligibility: telehealthInfo,
      };
    });

    // Log impressions for analytics
    const impressionIds = results.map(r => r.jobId);
    if (impressionIds.length > 0) {
      logImpression(matchRequest.did, impressionIds, 'matched').catch(err => {
        console.error('[match/jobs] Failed to log impression:', err);
      });
    }

    // Get telehealth summary for the clinician
    const telehealthSummary = getTelehealthEligibilitySummary(criteria);

    return res.json({
      matches: results,
      pagination: {
        total,
        limit,
        offset,
        hasMore: (offset + limit) < total,
      },
      clinicianProfile: {
        did: matchRequest.did,
        specialty: matchRequest.specialty,
        licenseStates: matchRequest.licenseStates,
        telehealthSummary,
      },
    });

  } catch (error: any) {
    console.error('[match/jobs] Error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid match request',
        details: error.errors,
      });
    }

    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to match jobs',
    });
  }
});

/**
 * GET /api/match/jobs/:did
 * Get saved matches for a clinician (requires prior match request)
 */
router.get('/match/jobs/:did', async (req: Request, res: Response) => {
  try {
    const { did } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    // TODO: Fetch saved matches from database
    // For now, return empty array
    return res.json({
      matches: [],
      pagination: {
        total: 0,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: false,
      },
      message: 'Use POST /api/match/jobs to generate matches',
    });

  } catch (error) {
    console.error('[match/jobs/:did] Error:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to fetch matches',
    });
  }
});

export default router;

