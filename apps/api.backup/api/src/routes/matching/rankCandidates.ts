/**
 * S72-STRETCH-D-005: AI-driven match service: candidate ranking endpoint
 *
 * POST /matching/rank takes jobId, returns ranked clinicianIds with score & explanation
 * Uses embeddings + features; tests with stub data
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { embedProfile, getCachedEmbedding } from '../../../../../services/matching/embeddings';
import { score, extractFeatureScores, cosineSimilarity } from '../../../../../services/matching/score';
import { generateExplanations, getTopExplanations } from '../../../../../services/matching/explanations';
import { DEFAULT_FEATURE_WEIGHTS, FeatureWeights } from '../../../../../services/matching/models/MatchingConfig';
import { EntityType } from '../../../../../services/matching/models/Embeddings';

const router = Router();
const prisma = new PrismaClient();

// Request schema
const RankCandidatesRequestSchema = z.object({
  jobId: z.string().min(1, 'Job ID is required'),
  limit: z.number().int().positive().max(100).optional().default(20),
  forceRefresh: z.boolean().optional().default(false),
});

/**
 * POST /matching/rank
 * Rank candidates for a job posting
 */
router.post('/matching/rank', async (req: Request, res: Response) => {
  try {
    const { jobId, limit, forceRefresh } = RankCandidatesRequestSchema.parse(req.body);

    // Fetch job posting
    const job = await prisma.jobPosting.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return res.status(404).json({
        error: 'job_not_found',
        message: `Job posting not found: ${jobId}`,
      });
    }

    // Get matching config (use default for now)
    const config = await prisma.matchingConfig.findFirst({
      where: { isDefault: true, isActive: true },
    });

    const weights: FeatureWeights = config
      ? (config.weights as FeatureWeights)
      : DEFAULT_FEATURE_WEIGHTS;

    // Get or generate job embedding
    let jobVec: number[];
    const cachedJobVec = await getCachedEmbedding(jobId, 'Job' as EntityType);
    if (cachedJobVec && !forceRefresh) {
      jobVec = cachedJobVec;
    } else {
      jobVec = await embedProfile(
        {
          specialty: job.specialty,
          description: job.description || undefined,
          requirements: job.requiredStates,
          preferences: {
            modality: job.modality,
            telehealth: job.telehealth,
            imlcAllowed: job.imlcAllowed,
            psypactAllowed: job.psypactAllowed,
            counselingCompactAllowed: job.counselingCompactAllowed,
          },
        },
        jobId,
        'Job' as EntityType,
        forceRefresh
      );
    }

    // Fetch all active clinicians (in production, would filter by specialty, etc.)
    // For now, fetch a sample set
    const clinicians = await prisma.user.findMany({
      where: {
        did: { not: null },
        roles: { has: 'holder' }, // Clinicians have 'holder' role
      },
      take: 100, // Limit for performance
      include: {
        npiClaims: true,
      },
    });

    // Rank candidates
    const candidates = [];

    for (const clinician of clinicians) {
      if (!clinician.did) continue;

      // Get or generate clinician embedding
      let clinVec: number[];
      const cachedClinVec = await getCachedEmbedding(
        clinician.did,
        'Clinician' as EntityType
      );
      if (cachedClinVec && !forceRefresh) {
        clinVec = cachedClinVec;
      } else {
        // Extract clinician profile data (simplified - would come from VCs in production)
        const npiClaim = clinician.npiClaims[0];
        clinVec = await embedProfile(
          {
            specialty: (clinician as any).metadata?.specialty || '',
            skills: (clinician as any).metadata?.skills || [],
            preferences: (clinician as any).metadata?.preferences || {},
          },
          clinician.did,
          'Clinician' as EntityType,
          forceRefresh
        );
      }

      // Extract feature scores (simplified - would extract from actual profiles)
      const features = extractFeatureScores(
        {
          specialty: (clinician as any).metadata?.specialty || '',
          location: (clinician as any).metadata?.location,
          experienceYears: (clinician as any).metadata?.experienceYears || 0,
          rating: (clinician as any).metadata?.rating || 0.5,
          burnoutRisk: (clinician as any).metadata?.burnoutRisk || 0.5,
        },
        {
          specialty: job.specialty,
          location: job.location as any,
          minExperienceYears: 0,
        }
      );

      // Compute score
      const matchScore = score(clinVec, jobVec, features, weights);
      const embeddingSimilarity = cosineSimilarity(clinVec, jobVec);

      // Generate explanations
      const explanations = generateExplanations(features, embeddingSimilarity, matchScore);
      const topExplanations = getTopExplanations(explanations, 5);

      candidates.push({
        clinicianId: clinician.did,
        clinicianName: clinician.name,
        score: matchScore,
        embeddingSimilarity,
        features,
        explanations: topExplanations.map((exp) => ({
          tag: exp.tag,
          message: exp.message,
          confidence: exp.confidence,
        })),
      });
    }

    // Sort by score (descending)
    candidates.sort((a, b) => b.score - a.score);

    // Return top N
    const rankedCandidates = candidates.slice(0, limit);

    return res.json({
      jobId,
      jobTitle: job.title,
      totalCandidates: candidates.length,
      rankedCandidates: rankedCandidates.map((c, index) => ({
        rank: index + 1,
        clinicianId: c.clinicianId,
        clinicianName: c.clinicianName,
        score: Math.round(c.score * 10000) / 10000, // Round to 4 decimal places
        explanation: c.explanations,
      })),
      weights,
    });
  } catch (error: any) {
    console.error('[matching/rank] Error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid request',
        details: error.errors,
      });
    }

    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to rank candidates',
      error_description: error.message,
    });
  }
});

export default router;

