/**
 * B132A-JOBS-005: Job search API with filters (specialty/location/telehealth)
 *
 * GET /jobs accepts filters; paginated response; tested for empty+filter cases
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { loadUserSession, requireAuth } from '../../../../backend/src/middleware/accessGuards';
import { ActiveOrgRequest, requireActiveOrg } from '../../middleware/requireActiveOrg';

const router = Router();
const prisma = new PrismaClient();
router.use(loadUserSession, requireAuth, requireActiveOrg);

// Search query schema
const JobSearchQuerySchema = z.object({
  specialty: z.string().optional(),
  state: z.string().length(2).optional(),
  modality: z.enum(['in-person', 'telehealth', 'hybrid']).optional(),
  telehealth: z.string().transform(val => val === 'true').optional(),
  imlcEligible: z.string().transform(val => val === 'true').optional(),
  multiStateOk: z.string().transform(val => val === 'true').optional(),
  minComp: z.string().transform(val => parseInt(val, 10)).optional(),
  maxComp: z.string().transform(val => parseInt(val, 10)).optional(),
  status: z.enum(['active', 'closed', 'filled']).optional(),
  limit: z.string().transform(val => Math.min(parseInt(val, 10), 100)).default('20'),
  offset: z.string().transform(val => parseInt(val, 10)).default('0'),
});

// Mock job data (in production, this would be a database query)
const mockJobs = [
  {
    id: 'job_1',
    partnerId: 'partner_1',
    externalJobId: 'ext_001',
    title: 'Family Medicine Physician - Remote',
    description: 'Join our telehealth team providing primary care services',
    specialty: '207Q00000X', // Family Medicine
    requiredStates: ['CA', 'NY', 'TX'],
    modality: 'telehealth',
    location: { city: 'San Francisco', state: 'CA', zip: '94105' },
    compRangeMin: 200000,
    compRangeMax: 300000,
    compCurrency: 'USD',
    telehealth: true,
    imlcEligible: true,
    multiStateOk: true,
    status: 'active',
    createdAt: '2025-11-01T00:00:00Z',
  },
  {
    id: 'job_2',
    partnerId: 'partner_1',
    title: 'Emergency Medicine Physician',
    description: 'Level 1 Trauma Center',
    specialty: '207P00000X', // Emergency Medicine
    requiredStates: ['NY'],
    modality: 'in-person',
    location: { city: 'New York', state: 'NY', zip: '10001' },
    compRangeMin: 250000,
    compRangeMax: 350000,
    compCurrency: 'USD',
    telehealth: false,
    imlcEligible: false,
    multiStateOk: false,
    status: 'active',
    createdAt: '2025-11-02T00:00:00Z',
  },
  {
    id: 'job_3',
    partnerId: 'partner_2',
    title: 'Cardiology - Hybrid Role',
    description: 'Mix of in-person clinic and telehealth consultations',
    specialty: '207RC0000X', // Cardiology
    requiredStates: ['CA', 'NV'],
    modality: 'hybrid',
    location: { city: 'Los Angeles', state: 'CA', zip: '90001' },
    compRangeMin: 300000,
    compRangeMax: 450000,
    compCurrency: 'USD',
    telehealth: true,
    imlcEligible: false,
    multiStateOk: true,
    status: 'active',
    createdAt: '2025-11-03T00:00:00Z',
  },
];

/**
 * GET /jobs
 * Search for job postings with filters
 */
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const activeOrgId = (req as ActiveOrgRequest).activeOrgId || null;
    // Validate query parameters
    const query = JobSearchQuerySchema.parse(req.query);

    // Apply filters
    let filteredJobs = [...mockJobs];

    if (query.specialty) {
      filteredJobs = filteredJobs.filter(job => job.specialty === query.specialty);
    }

    if (query.state) {
      filteredJobs = filteredJobs.filter(job =>
        job.requiredStates.includes(query.state!)
      );
    }

    if (query.modality) {
      filteredJobs = filteredJobs.filter(job => job.modality === query.modality);
    }

    if (query.telehealth !== undefined) {
      filteredJobs = filteredJobs.filter(job => job.telehealth === query.telehealth);
    }

    if (query.imlcEligible !== undefined) {
      filteredJobs = filteredJobs.filter(job => job.imlcEligible === query.imlcEligible);
    }

    if (query.multiStateOk !== undefined) {
      filteredJobs = filteredJobs.filter(job => job.multiStateOk === query.multiStateOk);
    }

    if (query.minComp !== undefined) {
      filteredJobs = filteredJobs.filter(job =>
        job.compRangeMax >= query.minComp!
      );
    }

    if (query.maxComp !== undefined) {
      filteredJobs = filteredJobs.filter(job =>
        job.compRangeMin <= query.maxComp!
      );
    }

    if (query.status) {
      filteredJobs = filteredJobs.filter(job => job.status === query.status);
    }

    // Count total before pagination
    const total = filteredJobs.length;

    // Apply pagination
    const limit = Number(query.limit);
    const offset = Number(query.offset);
    const paginatedJobs = filteredJobs.slice(offset, offset + limit);

    // S72-POST-3A-004: Include unitName when pilotUnitId is present
    // In a real implementation, this would query the database with include: { pilotUnit: { select: { name: true } } }
    const jobsWithUnitName = await Promise.all(
      paginatedJobs.map(async (job: any) => {
        if (job.pilotUnitId) {
          const unit = await prisma.pilotUnit.findUnique({
            where: { id: job.pilotUnitId },
            select: { name: true },
          });
          return {
            ...job,
            unitName: unit?.name || null,
          };
        }
        return job;
      })
    );

    // Calculate pagination metadata
    const hasMore = (offset + limit) < total;
    const nextOffset = hasMore ? offset + limit : null;

    return res.json({
      jobs: jobsWithUnitName,
      pagination: {
        total,
        limit,
        offset,
        hasMore,
        nextOffset,
      },
      filters: {
        specialty: query.specialty,
        state: query.state,
        modality: query.modality,
        telehealth: query.telehealth,
        imlcEligible: query.imlcEligible,
        multiStateOk: query.multiStateOk,
        minComp: query.minComp,
        maxComp: query.maxComp,
        status: query.status,
      },
      activeOrgId,
    });

  } catch (error: any) {
    console.error('[jobs/search] Error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid query parameters',
        details: error.errors,
      });
    }

    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to search jobs',
    });
  }
});

/**
 * GET /jobs/:jobId
 * Get job details by ID
 */
router.get('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const activeOrgId = (req as ActiveOrgRequest).activeOrgId || null;

    const job = mockJobs.find(j => j.id === jobId);

    if (!job) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Job not found',
      });
    }

    return res.json({ job, activeOrgId });

  } catch (error) {
    console.error('[jobs/:jobId] Error:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to fetch job',
    });
  }
});

export default router;

