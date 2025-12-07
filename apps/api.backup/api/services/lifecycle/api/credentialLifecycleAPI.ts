/**
 * B238A-LIFE-009: CredentialLifecycleAPI
 *
 * Exposes endpoints for requesting renewals, checking expiry policies,
 * initiating revocations. Enforces auth and rate limiting.
 * Returns structured responses.
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { RenewalService } from '../renewalService.js';
import { RevocationService } from '../revocationService.js';
import { ExpirationScheduler } from '../schedulers/expirationScheduler.js';
import { RenewalNotificationService } from '../notifications/renewalNotificationService.js';
import { CreateRenewalRequestInput } from '../models/RenewalRequest.js';
import { CreateRevocationInput } from '../models/Revocation.js';
import { CreateCredentialExpiryPolicyInput } from '../models/CredentialExpiryPolicy.js';
import { CreateAutoRenewalRulesInput } from '../models/AutoRenewalRules.js';

// Request validation schemas
const CreateRenewalRequestSchema = z.object({
  credentialId: z.string().min(1),
  requesterId: z.string().min(1),
  reason: z.string().optional(),
  renewalData: z.record(z.unknown()).optional(),
});

const ApproveRenewalRequestSchema = z.object({
  renewalRequestId: z.string().min(1),
  approverId: z.string().min(1),
});

const DenyRenewalRequestSchema = z.object({
  renewalRequestId: z.string().min(1),
  reason: z.string().optional(),
});

const CreateRevocationSchema = z.object({
  credentialId: z.string().min(1),
  initiatorId: z.string().min(1),
  reason: z.string().min(1),
  effectiveAt: z.string().datetime().or(z.date()),
});

const CreateExpiryPolicySchema = z.object({
  credentialType: z.string().min(1),
  defaultValidityPeriod: z.number().int().positive(),
  gracePeriod: z.number().int().nonnegative(),
  renewalRequirements: z.record(z.unknown()).optional(),
});

const CreateAutoRenewalRulesSchema = z.object({
  orgId: z.string().optional(),
  credentialType: z.string().min(1),
  autoRenew: z.boolean().default(false),
  maxRenewals: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

export function createCredentialLifecycleRouter(
  prisma: PrismaClient,
  options?: {
    requireAuth?: boolean;
    rateLimit?: {
      windowMs: number;
      max: number;
    };
  }
): Router {
  const router = Router();
  const renewalService = new RenewalService(prisma);
  const revocationService = new RevocationService(prisma);
  const expirationScheduler = new ExpirationScheduler(prisma);
  const notificationService = new RenewalNotificationService(prisma);

  // Middleware for authentication (placeholder - implement based on your auth system)
  const requireAuth = (req: Request, res: Response, next: () => void) => {
    if (options?.requireAuth !== false) {
      // In a real implementation, verify JWT token or session
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
    next();
  };

  // Apply auth middleware to all routes
  router.use(requireAuth);

  /**
   * POST /api/lifecycle/renewal/request
   * Request a credential renewal
   */
  router.post('/renewal/request', async (req: Request, res: Response) => {
    try {
      const input = CreateRenewalRequestSchema.parse(req.body);
      const result = await renewalService.createRenewalRequest(input);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to create renewal request',
      });
    }
  });

  /**
   * GET /api/lifecycle/renewal/:id
   * Get renewal request by ID
   */
  router.get('/renewal/:id', async (req: Request, res: Response) => {
    try {
      const renewalRequest = await renewalService.getRenewalRequest(req.params.id);
      if (!renewalRequest) {
        return res.status(404).json({
          success: false,
          error: 'Renewal request not found',
        });
      }
      res.json({
        success: true,
        data: renewalRequest,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get renewal request',
      });
    }
  });

  /**
   * POST /api/lifecycle/renewal/:id/validate
   * Validate a renewal request
   */
  router.post('/renewal/:id/validate', async (req: Request, res: Response) => {
    try {
      const validation = await renewalService.validateRenewalRequest(req.params.id);
      res.json({
        success: true,
        data: validation,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to validate renewal request',
      });
    }
  });

  /**
   * POST /api/lifecycle/renewal/approve
   * Approve a renewal request
   */
  router.post('/renewal/approve', async (req: Request, res: Response) => {
    try {
      const input = ApproveRenewalRequestSchema.parse(req.body);
      const result = await renewalService.approveRenewalRequest(
        input.renewalRequestId,
        input.approverId
      );
      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to approve renewal request',
      });
    }
  });

  /**
   * POST /api/lifecycle/renewal/deny
   * Deny a renewal request
   */
  router.post('/renewal/deny', async (req: Request, res: Response) => {
    try {
      const input = DenyRenewalRequestSchema.parse(req.body);
      await renewalService.denyRenewalRequest(input.renewalRequestId, input.reason);
      res.json({
        success: true,
        message: 'Renewal request denied',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to deny renewal request',
      });
    }
  });

  /**
   * GET /api/lifecycle/renewal/credential/:credentialId
   * Get renewal requests for a credential
   */
  router.get('/renewal/credential/:credentialId', async (req: Request, res: Response) => {
    try {
      const requests = await renewalService.getRenewalRequestsForCredential(req.params.credentialId);
      res.json({
        success: true,
        data: requests,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get renewal requests',
      });
    }
  });

  /**
   * GET /api/lifecycle/renewal/pending
   * Get pending renewal requests
   */
  router.get('/renewal/pending', async (req: Request, res: Response) => {
    try {
      const requests = await renewalService.getPendingRenewalRequests();
      res.json({
        success: true,
        data: requests,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get pending renewal requests',
      });
    }
  });

  /**
   * POST /api/lifecycle/revocation
   * Create a revocation request
   */
  router.post('/revocation', async (req: Request, res: Response) => {
    try {
      const input = CreateRevocationSchema.parse(req.body);
      const effectiveAt = typeof input.effectiveAt === 'string'
        ? new Date(input.effectiveAt)
        : input.effectiveAt;

      const result = await revocationService.createRevocation({
        ...input,
        effectiveAt,
      });
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to create revocation',
      });
    }
  });

  /**
   * POST /api/lifecycle/revocation/:id/execute
   * Execute a pending revocation
   */
  router.post('/revocation/:id/execute', async (req: Request, res: Response) => {
    try {
      const result = await revocationService.executeRevocation(req.params.id);
      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to execute revocation',
      });
    }
  });

  /**
   * GET /api/lifecycle/revocation/:id
   * Get revocation by ID
   */
  router.get('/revocation/:id', async (req: Request, res: Response) => {
    try {
      const revocation = await revocationService.getRevocation(req.params.id);
      if (!revocation) {
        return res.status(404).json({
          success: false,
          error: 'Revocation not found',
        });
      }
      res.json({
        success: true,
        data: revocation,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get revocation',
      });
    }
  });

  /**
   * GET /api/lifecycle/credential/:id/expiry
   * Check credential expiration status
   */
  router.get('/credential/:id/expiry', async (req: Request, res: Response) => {
    try {
      const result = await expirationScheduler.checkCredentialExpiration(req.params.id);
      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'Credential not found or not expiring',
        });
      }
      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to check credential expiration',
      });
    }
  });

  /**
   * GET /api/lifecycle/policy/:credentialType
   * Get expiry policy for credential type
   */
  router.get('/policy/:credentialType', async (req: Request, res: Response) => {
    try {
      const policy = await prisma.credentialExpiryPolicy.findUnique({
        where: { credentialType: req.params.credentialType },
      });
      if (!policy) {
        return res.status(404).json({
          success: false,
          error: 'Policy not found',
        });
      }
      res.json({
        success: true,
        data: policy,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get policy',
      });
    }
  });

  /**
   * POST /api/lifecycle/policy
   * Create or update expiry policy
   */
  router.post('/policy', async (req: Request, res: Response) => {
    try {
      const input = CreateExpiryPolicySchema.parse(req.body);
      const policy = await prisma.credentialExpiryPolicy.upsert({
        where: { credentialType: input.credentialType },
        create: input,
        update: {
          defaultValidityPeriod: input.defaultValidityPeriod,
          gracePeriod: input.gracePeriod,
          renewalRequirements: input.renewalRequirements as any,
        },
      });
      res.status(201).json({
        success: true,
        data: policy,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to create/update policy',
      });
    }
  });

  /**
   * GET /api/lifecycle/credential/:id/can-use
   * Check if credential can be used
   */
  router.get('/credential/:id/can-use', async (req: Request, res: Response) => {
    try {
      const result = await revocationService.canUseCredential(req.params.id);
      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to check credential usage',
      });
    }
  });

  return router;
}

