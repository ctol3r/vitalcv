/**
 * B132A-WIDGET-001: Public Apply-with-VitalCV endpoint (JWT+DPoP protected)
 *
 * POST /apply-with-vc accepts signed VC bundle; DPoP enforced; returns applicationId
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { validateApplication, ApplicationStatus, type ApplicationSubmission } from '../../../../services/jobs/models/Application';
import { dpopGuard } from '../middleware/dpopGuard';
import { jwtAuthMiddleware } from '../middleware/jwtAuth';
import { widgetCorsMiddleware } from '../middleware/security/widgetCors';
import { rateLimitApply } from '../middleware/rateLimitApply';
import { applicationQueue } from '../../../../services/jobs/queues/applications';
import { featureFlagGuard, checkFeatureFlag, getFeatureFlagService } from '../../../../services/flags/featureFlags';
import { applyWithVCKillSwitchGuard } from '../../../../services/flags/wireKillSwitches';
import { riskGate } from '../middleware/riskGate';
import { eventBus } from '../../../../backend/src/services/notifications/eventBus';

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /apply-with-vc
 * Submit a job application with VitalCV credentials
 *
 * Security:
 * - JWT authentication (widget token)
 * - DPoP proof required
 * - CORS restricted to allowed partner origins
 * - Rate limited per partner
 */
/**
 * B149B-FF-008: Guard Apply-with-VitalCV APIs behind feature flag `applyWithVC.enabled`
 */
router.post(
  '/apply-with-vc',
  widgetCorsMiddleware,
  jwtAuthMiddleware,
  dpopGuard,
  rateLimitApply, // B143E-SPAM-003: Rate limit Apply-with-VitalCV endpoints
  riskGate('applyWithVC'), // B143F-LOOP-002: Risk gate middleware for high-value endpoint
  applyWithVCKillSwitchGuard, // B141D-FF-005: Kill-switch guard (emergency shutdown)
  featureFlagGuard('applyWithVC.enabled', {
    statusCode: 503,
    errorCode: 'FEATURE_DISABLED',
    errorMessage: 'Apply with VitalCV feature is currently disabled. Please contact support for more information.',
  }),
  async (req: Request, res: Response) => {
    try {
      // Validate request body
      const applicationData: ApplicationSubmission = validateApplication(req.body);

      // Verify DPoP binding
      const dpopJkt = (req as any).dpop?.jkt;
      if (!dpopJkt) {
        return res.status(401).json({
          error: 'dpop_required',
          message: 'DPoP proof is required for this endpoint',
        });
      }

      // Extract partner info from JWT
      const partnerId = (req as any).auth?.sub;
      const jobId = (req as any).auth?.jobId || applicationData.jobId;

      // B146A-QA-002: Check if clinician profile exists
      const clinicianProfile = await prisma.user.findUnique({
        where: { did: applicationData.applicantDid },
      });

      if (!clinicianProfile) {
        return res.status(400).json({
          errorCode: 'CLINICIAN_PROFILE_NOT_FOUND',
          message: `No clinician profile found for DID: ${applicationData.applicantDid}`,
        });
      }

      // B146A-QA-003: Check if job exists
      const job = await prisma.jobPosting.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        return res.status(404).json({
          errorCode: 'JOB_NOT_FOUND',
          message: `Job not found: ${jobId}`,
        });
      }

      // Basic validation of VC bundle
      if (!applicationData.evidenceBundle) {
        return res.status(400).json({
          error: 'invalid_request',
          message: 'evidenceBundle is required',
        });
      }

      // Verify bundle is signed (basic check - full verification happens async)
      const hasSignature = applicationData.evidenceBundle.proof ||
                           applicationData.evidenceBundle.signatures;
      if (!hasSignature) {
        return res.status(400).json({
          error: 'invalid_bundle',
          message: 'VC bundle must be signed',
        });
      }

      // Generate application ID
      const applicationId = `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create application record (synchronous, lightweight)
      const application = {
        id: applicationId,
        applicantDid: applicationData.applicantDid,
        jobId: jobId,
        evidenceIds: applicationData.evidenceIds,
        evidenceBundle: applicationData.evidenceBundle,
        status: ApplicationStatus.PENDING,
        metadata: {
          ...applicationData.metadata,
          partnerId,
          submittedVia: 'widget',
          dpopJkt,
          submittedAt: new Date().toISOString(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store application (in-memory or database - implement based on your data layer)
      // For now, we'll enqueue it for async processing
      await applicationQueue.enqueue({
        type: 'application.created',
        applicationId,
        application,
        priority: 'normal',
      });

      eventBus.emitEvent('ApplicationCreated', {
        applicationId,
        jobId,
        orgId: job.partnerId || partnerId || undefined,
        applicantDid: applicationData.applicantDid,
        partnerId: partnerId || job.partnerId,
        source: 'apply-with-vc',
        evidenceCount: applicationData.evidenceIds.length,
      });

      // Log submission
      console.log(`[apply-with-vc] Application ${applicationId} submitted`, {
        applicantDid: applicationData.applicantDid,
        jobId,
        partnerId,
        evidenceCount: applicationData.evidenceIds.length,
      });

      // Return success response immediately
      return res.status(201).json({
        applicationId,
        status: 'PENDING',
        message: 'Application submitted successfully',
        nextSteps: [
          'VC verification in progress',
          'Eligibility check scheduled',
          'Partner notification pending',
        ],
      });

    } catch (error: any) {
      console.error('[apply-with-vc] Error:', error);

      // Handle validation errors
      if (error.name === 'ZodError') {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Invalid application data',
          details: error.errors,
        });
      }

      // Handle other errors
      return res.status(500).json({
        error: 'internal_error',
        message: 'Failed to process application',
      });
    }
  }
);

/**
 * GET /apply-with-vc/status/:applicationId
 * Check application status
 */
router.get(
  '/apply-with-vc/status/:applicationId',
  widgetCorsMiddleware,
  jwtAuthMiddleware,
  applyWithVCKillSwitchGuard, // B141D-FF-005: Kill-switch guard (emergency shutdown)
  featureFlagGuard('applyWithVC.enabled', {
    statusCode: 503,
    errorCode: 'FEATURE_DISABLED',
    errorMessage: 'Apply with VitalCV feature is currently disabled. Please contact support for more information.',
  }),
  async (req: Request, res: Response) => {
    try {
      const { applicationId } = req.params;

      // TODO: Fetch from database
      // For now, return mock status
      return res.json({
        applicationId,
        status: 'PENDING',
        stages: {
          submitted: { completed: true, timestamp: new Date().toISOString() },
          vcVerified: { completed: false },
          eligibilityChecked: { completed: false },
          partnerNotified: { completed: false },
        },
      });

    } catch (error) {
      console.error('[apply-with-vc/status] Error:', error);
      return res.status(500).json({
        error: 'internal_error',
        message: 'Failed to fetch application status',
      });
    }
  }
);

export default router;

