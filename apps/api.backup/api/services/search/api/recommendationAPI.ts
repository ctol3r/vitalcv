/**
 * B232B-SEARCH-010: RecommendationAPIs
 *
 * Exposes endpoints for client apps to retrieve personalized module and credential recommendations.
 * Enforces auth and rate limiting.
 * Returns explanation metadata.
 */

import { Request, Response, Router } from 'express';
import { moduleRecommendationEngine } from '../recommendation/moduleRecommendationEngine.js';
import { credentialRecommendationEngine } from '../recommendation/credentialRecommendationEngine.js';
import { RateLimiter } from '../../../backend/src/middleware/rateLimiter.js';
import { requireAuth, AuthRequest } from '../../../backend/src/middlewares/guards.js';

const router = Router();

// Rate limiters
const recommendationLimiter = new RateLimiter(60000, 20); // 20 requests per minute

/**
 * GET /api/recommendations/modules
 * Get module recommendations for the authenticated user/organization
 */
router.get(
  '/modules',
  recommendationLimiter.middleware((req) => {
    const authReq = req as AuthRequest;
    return authReq.user?.id || req.ip || 'unknown';
  }),
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;
      const orgId = req.query.orgId as string | undefined;

      // Get context from query parameters
      const specialty = req.query.specialty as string | undefined;
      const region = req.query.region as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      // Get previous purchases if orgId is provided
      let previousPurchases: string[] | undefined;
      if (orgId) {
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        const purchases = await prisma.marketplacePurchase.findMany({
          where: {
            orgId,
            status: 'completed',
          },
          include: {
            listing: true,
          },
        });
        previousPurchases = purchases
          .map((p) => (p.listing.metadata as any)?.moduleId)
          .filter((id): id is string => !!id);
      }

      const recommendations = await moduleRecommendationEngine.getRecommendations({
        userId,
        orgId,
        specialty,
        region,
        previousPurchases,
        limit,
      });

      res.json({
        success: true,
        recommendations,
        metadata: {
          count: recommendations.length,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error('[RecommendationAPI] Error getting module recommendations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get module recommendations',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/recommendations/credentials
 * Get credential recommendations for the authenticated clinician
 */
router.get(
  '/credentials',
  recommendationLimiter.middleware((req) => {
    const authReq = req as AuthRequest;
    return authReq.user?.id || req.ip || 'unknown';
  }),
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required',
        });
      }

      // Get context from query parameters
      const specialty = req.query.specialty as string | undefined;
      const region = req.query.region as string | undefined;
      const careerStage = req.query.careerStage as 'early' | 'mid' | 'senior' | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      // Get current credentials
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      const currentCredentials = await prisma.credential.findMany({
        where: {
          // Assuming userId maps to holderDid or similar
          // Adjust based on your schema
          status: 'ACTIVE',
        },
        select: {
          type: true,
        },
      });

      const recommendations = await credentialRecommendationEngine.getRecommendations({
        clinicianId: userId,
        currentCredentials: currentCredentials.map((c) => c.type),
        specialty,
        region,
        careerStage,
        limit,
      });

      res.json({
        success: true,
        recommendations,
        metadata: {
          count: recommendations.length,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error('[RecommendationAPI] Error getting credential recommendations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get credential recommendations',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/recommendations/modules/:moduleId/explanation
 * Get detailed explanation for why a specific module was recommended
 */
router.get(
  '/modules/:moduleId/explanation',
  recommendationLimiter.middleware((req) => {
    const authReq = req as AuthRequest;
    return authReq.user?.id || req.ip || 'unknown';
  }),
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;
      const moduleId = req.params.moduleId;
      const orgId = req.query.orgId as string | undefined;

      const specialty = req.query.specialty as string | undefined;
      const region = req.query.region as string | undefined;

      // Get recommendations and find the specific module
      const recommendations = await moduleRecommendationEngine.getRecommendations({
        userId,
        orgId,
        specialty,
        region,
        limit: 100, // Get more to find the specific module
      });

      const moduleRecommendation = recommendations.find((r) => r.moduleId === moduleId);

      if (!moduleRecommendation) {
        return res.status(404).json({
          success: false,
          error: 'Module recommendation not found',
        });
      }

      res.json({
        success: true,
        explanation: {
          moduleId: moduleRecommendation.moduleId,
          moduleName: moduleRecommendation.moduleName,
          score: moduleRecommendation.score,
          reasons: moduleRecommendation.reasons,
          matchFactors: moduleRecommendation.matchFactors,
        },
      });
    } catch (error: any) {
      console.error('[RecommendationAPI] Error getting module explanation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get module explanation',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/recommendations/credentials/:credentialType/explanation
 * Get detailed explanation for why a specific credential was recommended
 */
router.get(
  '/credentials/:credentialType/explanation',
  recommendationLimiter.middleware((req) => {
    const authReq = req as AuthRequest;
    return authReq.user?.id || req.ip || 'unknown';
  }),
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;
      const credentialType = req.params.credentialType;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required',
        });
      }

      const specialty = req.query.specialty as string | undefined;
      const region = req.query.region as string | undefined;
      const careerStage = req.query.careerStage as 'early' | 'mid' | 'senior' | undefined;

      // Get recommendations and find the specific credential
      const recommendations = await credentialRecommendationEngine.getRecommendations({
        clinicianId: userId,
        specialty,
        region,
        careerStage,
        limit: 100, // Get more to find the specific credential
      });

      const credentialRecommendation = recommendations.find(
        (r) => r.credentialType === credentialType
      );

      if (!credentialRecommendation) {
        return res.status(404).json({
          success: false,
          error: 'Credential recommendation not found',
        });
      }

      res.json({
        success: true,
        explanation: {
          credentialType: credentialRecommendation.credentialType,
          credentialName: credentialRecommendation.credentialName,
          score: credentialRecommendation.score,
          reasons: credentialRecommendation.reasons,
          matchFactors: credentialRecommendation.matchFactors,
          estimatedValue: credentialRecommendation.estimatedValue,
        },
      });
    } catch (error: any) {
      console.error('[RecommendationAPI] Error getting credential explanation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get credential explanation',
        message: error.message,
      });
    }
  }
);

export default router;

