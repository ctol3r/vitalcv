/**
 * B233B-CAREER-009: CareerAnalyticsAPI
 *
 * Exposes endpoints for client apps to retrieve workforce demand forecasts,
 * personal progress metrics, and recommended training;
 * enforces auth; returns summary and detailed data
 */

import { Router, Request, Response, NextFunction } from 'express';
import { WorkforceDemandForecaster } from '../analytics/workforceDemandForecaster.js';
import { TrainingRecommendationEngine, CareerProfile } from '../recommendation/trainingRecommendationEngine.js';
import { MentorshipRecommendationEngine, MentorshipProfile } from '../recommendation/mentorshipRecommendationEngine.js';
import { DemandTrendReports } from '../analytics/demandTrendReports.js';
import { PrismaClient } from '@prisma/client';

// Define AuthenticatedRequest interface locally to avoid import path issues
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string | number;
    email: string;
    roles: string[];
    claimLevel: number;
    did?: string;
  };
}

// Simple requireAuth middleware - in production, use the actual middleware from backend
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  // In production, this would validate JWT or session
  // For now, expect x-user-id header
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  // Set minimal user object - in production, load from database
  authReq.user = {
    id: userId as string,
    email: '',
    roles: [],
    claimLevel: 0,
  };
  next();
}

export function createCareerAnalyticsRouter(prisma: PrismaClient): Router {
  const router = Router();

  const demandForecaster = new WorkforceDemandForecaster(prisma);
  const trainingEngine = new TrainingRecommendationEngine(prisma, demandForecaster);
  const mentorshipEngine = new MentorshipRecommendationEngine(prisma);
  const trendReports = new DemandTrendReports(prisma, demandForecaster);

  /**
   * GET /api/career/demand-forecast
   * Get workforce demand forecasts
   * Query params: specialty?, region?, horizonDays?
   */
  router.get(
    '/demand-forecast',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const specialty = req.query.specialty as string | undefined;
        const region = req.query.region as string | undefined;
        const horizonDays = req.query.horizonDays
          ? (req.query.horizonDays as string).split(',').map(Number)
          : undefined;

        const forecasts = await demandForecaster.predictDemand({
          specialty,
          region,
          horizonDays,
          includeTrends: true,
        });

        res.json({
          success: true,
          data: {
            forecasts,
            summary: {
              count: forecasts.length,
              specialties: [...new Set(forecasts.map((f) => f.specialty))],
              regions: [...new Set(forecasts.map((f) => f.region))],
            },
          },
        });
      } catch (error: any) {
        console.error('Error fetching demand forecast:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch demand forecast',
          message: error.message,
        });
      }
    }
  );

  /**
   * GET /api/career/demand-forecast/summary
   * Get summary demand forecast (lightweight)
   */
  router.get(
    '/demand-forecast/summary',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const specialty = req.query.specialty as string | undefined;
        const region = req.query.region as string | undefined;

        const forecasts = await demandForecaster.predictDemand({
          specialty,
          region,
          horizonDays: [30, 90],
          includeTrends: true,
        });

        // Return summary format
        const summary = forecasts.map((f) => ({
          specialty: f.specialty,
          region: f.region,
          horizonDays: f.horizonDays,
          predictedDemand: f.predictedDemand,
          trend: f.trend,
        }));

        res.json({
          success: true,
          data: summary,
        });
      } catch (error: any) {
        console.error('Error fetching demand forecast summary:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch demand forecast summary',
          message: error.message,
        });
      }
    }
  );

  /**
   * GET /api/career/progress-metrics
   * Get personal progress metrics for authenticated user
   */
  router.get(
    '/progress-metrics',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user!.id.toString();

        // Get user's credentials
        const credentials = await prisma.credential.findMany({
          where: {
            userId,
            status: 'active',
          },
          select: {
            type: true,
            issuedAt: true,
            expiresAt: true,
          },
        });

        // Get user's NPI claim for specialty/region
        const npiClaim = await prisma.npiClaim.findFirst({
          where: {
            userId,
          },
          select: {
            tags: true,
          },
        });

        const specialty =
          (npiClaim?.tags as any)?.specialty?.[0] || undefined;
        const region = (npiClaim?.tags as any)?.region?.[0] || undefined;

        // Get demand forecast for user's specialty/region
        const relevantForecasts = await demandForecaster.predictDemand({
          specialty,
          region,
          horizonDays: [90],
        });

        // Calculate progress metrics
        const activeCredentials = credentials.filter(
          (c) => !c.expiresAt || new Date(c.expiresAt) > new Date()
        );
        const expiringSoon = credentials.filter(
          (c) =>
            c.expiresAt &&
            new Date(c.expiresAt) > new Date() &&
            new Date(c.expiresAt) <
              new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        );

        res.json({
          success: true,
          data: {
            credentials: {
              total: credentials.length,
              active: activeCredentials.length,
              expiringSoon: expiringSoon.length,
            },
            demandForecast: relevantForecasts[0]
              ? {
                  specialty: relevantForecasts[0].specialty,
                  region: relevantForecasts[0].region,
                  predictedDemand: relevantForecasts[0].predictedDemand,
                  trend: relevantForecasts[0].trend,
                }
              : null,
            specialty,
            region,
          },
        });
      } catch (error: any) {
        console.error('Error fetching progress metrics:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch progress metrics',
          message: error.message,
        });
      }
    }
  );

  /**
   * GET /api/career/training-recommendations
   * Get recommended training courses for user
   * Query params: limit?, minScore?
   */
  router.get(
    '/training-recommendations',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user!.id.toString();
        const limit = req.query.limit
          ? parseInt(req.query.limit as string)
          : 10;
        const minScore = req.query.minScore
          ? parseFloat(req.query.minScore as string)
          : 0.3;

        // Get user's specialty/region from NPI claim
        const npiClaim = await prisma.npiClaim.findFirst({
          where: {
            userId,
          },
          select: {
            tags: true,
          },
        });

        const specialty =
          (npiClaim?.tags as any)?.specialty?.[0] || undefined;
        const region = (npiClaim?.tags as any)?.region?.[0] || undefined;

        // Get user's current credentials
        const credentials = await prisma.credential.findMany({
          where: {
            userId,
            status: 'active',
          },
          select: {
            type: true,
          },
        });

        const careerProfile: CareerProfile = {
          userId,
          specialty,
          region,
          currentCredentials: credentials.map((c) => c.type),
        };

        const recommendations = await trainingEngine.recommend({
          careerProfile,
          limit,
          minScore,
        });

        res.json({
          success: true,
          data: {
            recommendations,
            summary: {
              count: recommendations.length,
              averageScore:
                recommendations.length > 0
                  ? recommendations.reduce((sum, r) => sum + r.score, 0) /
                    recommendations.length
                  : 0,
            },
          },
        });
      } catch (error: any) {
        console.error('Error fetching training recommendations:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch training recommendations',
          message: error.message,
        });
      }
    }
  );

  /**
   * GET /api/career/mentorship-recommendations
   * Get recommended mentors for user
   */
  router.get(
    '/mentorship-recommendations',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user!.id.toString();
        const limit = req.query.limit
          ? parseInt(req.query.limit as string)
          : 5;

        // Get user's specialty/interests from NPI claim
        const npiClaim = await prisma.npiClaim.findFirst({
          where: {
            userId,
          },
          select: {
            tags: true,
          },
        });

        const specialty =
          (npiClaim?.tags as any)?.specialty?.[0] || undefined;
        const region = (npiClaim?.tags as any)?.region?.[0] || undefined;

        const menteeProfile: MentorshipProfile = {
          userId,
          specialty,
          region,
        };

        const recommendations = await mentorshipEngine.recommend({
          menteeProfile,
          limit,
        });

        res.json({
          success: true,
          data: {
            recommendations,
            summary: {
              count: recommendations.length,
            },
          },
        });
      } catch (error: any) {
        console.error('Error fetching mentorship recommendations:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch mentorship recommendations',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /api/career/mentorship/opt-in
   * Opt in as a mentor
   */
  router.post(
    '/mentorship/opt-in',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user!.id.toString();
        await mentorshipEngine.optInAsMentor(userId, req.body);
        res.json({
          success: true,
          message: 'Successfully opted in as mentor',
        });
      } catch (error: any) {
        console.error('Error opting in as mentor:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to opt in as mentor',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /api/career/mentorship/opt-out
   * Opt out as a mentor or from mentorship recommendations
   */
  router.post(
    '/mentorship/opt-out',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user!.id.toString();
        const { asMentor } = req.body;

        if (asMentor) {
          await mentorshipEngine.optOutAsMentor(userId);
        } else {
          await mentorshipEngine.optOutOfMentorship(userId);
        }

        res.json({
          success: true,
          message: 'Successfully opted out',
        });
      } catch (error: any) {
        console.error('Error opting out:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to opt out',
          message: error.message,
        });
      }
    }
  );

  /**
   * GET /api/career/trend-reports
   * Get demand trend reports (for administrators/partners)
   * Query params: specialty?, region?, format? (json|csv|pdf)
   */
  router.get(
    '/trend-reports',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const specialty = req.query.specialty as string | undefined;
        const region = req.query.region as string | undefined;
        const format = (req.query.format as string) || 'json';
        const startDate = req.query.startDate
          ? new Date(req.query.startDate as string)
          : undefined;
        const endDate = req.query.endDate
          ? new Date(req.query.endDate as string)
          : undefined;

        const filters = {
          specialty,
          region,
          startDate,
          endDate,
          format: format as 'json' | 'csv' | 'pdf',
        };

        if (format === 'csv') {
          const csv = await trendReports.exportCSV(filters);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="demand-trend-report-${Date.now()}.csv"`
          );
          return res.send(csv);
        }

        if (format === 'pdf') {
          const pdf = await trendReports.exportPDF(filters);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="demand-trend-report-${Date.now()}.pdf"`
          );
          return res.send(pdf);
        }

        // Default: JSON
        const report = await trendReports.generateReport(filters);
        res.json({
          success: true,
          data: report,
        });
      } catch (error: any) {
        console.error('Error generating trend report:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to generate trend report',
          message: error.message,
        });
      }
    }
  );

  /**
   * GET /api/career/trend-reports/dashboard
   * Get dashboard data (summary format)
   */
  router.get(
    '/trend-reports/dashboard',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const specialty = req.query.specialty as string | undefined;
        const region = req.query.region as string | undefined;

        const dashboardData = await trendReports.generateDashboardData({
          specialty,
          region,
        });

        res.json({
          success: true,
          data: dashboardData,
        });
      } catch (error: any) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch dashboard data',
          message: error.message,
        });
      }
    }
  );

  return router;
}

