/**
 * B248A-PARTNER-007: PartnerDataAPI
 *
 * REST endpoints to create/read/update partner profiles, contact persons, and agreements;
 * enforces RBAC; validates inputs; supports pagination & filtering; tests cover CRUD operations and authorization
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, PartnerStatus } from '@prisma/client';
import * as PartnerProfile from '../models/PartnerProfile.js';
import * as ContactPerson from '../models/ContactPerson.js';
import * as PartnershipAgreement from '../models/PartnershipAgreement.js';
import * as PartnershipPolicy from '../models/PartnershipPolicy.js';
import { PartnerRegistrationService } from '../services/partnerRegistrationService.js';
import { PartnerDocumentUploadService } from '../services/partnerDocumentUploadService.js';
import { PartnerAuditLogService } from '../services/partnerAuditLogService.js';
import { validateTransition } from '../models/PartnerStatus.js';

// Define AuthenticatedRequest interface
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
}

// RBAC: Check if user has required role
function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const hasRole = authReq.user.roles.some((role) => allowedRoles.includes(role));
    if (!hasRole) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Simple auth middleware (in production, use JWT validation)
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  const userId = req.headers['x-user-id'] as string;
  const userRoles = (req.headers['x-user-roles'] as string)?.split(',') || [];

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  authReq.user = {
    id: userId,
    email: '',
    roles: userRoles,
  };
  next();
}

export function createPartnerDataRouter(prisma: PrismaClient): Router {
  const router = Router();
  const registrationService = new PartnerRegistrationService(prisma);
  const documentService = new PartnerDocumentUploadService(prisma);
  const auditService = new PartnerAuditLogService(prisma);

  // ========== Partner Profile Endpoints ==========

  /**
   * POST /api/partners
   * Create a new partner profile
   * Requires: admin, partner_manager roles
   */
  router.post(
    '/',
    requireAuth,
    requireRole(['admin', 'partner_manager']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const input: PartnerProfile.PartnerProfileInput = req.body;
        const partner = await PartnerProfile.createPartnerProfile(prisma, input);

        // Audit log
        await auditService.logPartnerProfileCreated(
          partner.id,
          input as any,
          req.user?.id
        );

        res.status(201).json({
          success: true,
          data: partner,
        });
      } catch (error: any) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /api/partners
   * List partner profiles with pagination and filtering
   */
  router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const type = req.query.type as string | undefined;
      const status = req.query.status as PartnerStatus | undefined;
      const skip = req.query.skip ? parseInt(req.query.skip as string) : undefined;
      const take = req.query.take ? parseInt(req.query.take as string) : undefined;

      const partners = await PartnerProfile.getPartnerProfiles(prisma, {
        type,
        status,
        skip,
        take,
      });

      res.json({
        success: true,
        data: partners,
        pagination: {
          skip: skip ?? 0,
          take: take ?? partners.length,
          total: partners.length,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/partners/:id
   * Get a single partner profile
   */
  router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const partner = await PartnerProfile.getPartnerProfile(prisma, req.params.id);
      if (!partner) {
        return res.status(404).json({
          success: false,
          error: 'Partner not found',
        });
      }

      res.json({
        success: true,
        data: partner,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * PATCH /api/partners/:id
   * Update a partner profile
   * Requires: admin, partner_manager roles
   */
  router.patch(
    '/:id',
    requireAuth,
    requireRole(['admin', 'partner_manager']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const oldPartner = await PartnerProfile.getPartnerProfile(prisma, req.params.id);
        if (!oldPartner) {
          return res.status(404).json({
            success: false,
            error: 'Partner not found',
          });
        }

        const updates: Partial<PartnerProfile.PartnerProfileInput> = req.body;

        // Validate status transition if status is being updated
        if (updates.status && oldPartner.status !== updates.status) {
          validateTransition(oldPartner.status, updates.status);
        }

        const updated = await PartnerProfile.updatePartnerProfile(
          prisma,
          req.params.id,
          updates
        );

        // Audit log
        await auditService.logPartnerProfileUpdated(
          req.params.id,
          oldPartner as any,
          updated as any,
          req.user?.id
        );

        res.json({
          success: true,
          data: updated,
        });
      } catch (error: any) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * DELETE /api/partners/:id
   * Delete a partner profile
   * Requires: admin role
   */
  router.delete(
    '/:id',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const partner = await PartnerProfile.getPartnerProfile(prisma, req.params.id);
        if (!partner) {
          return res.status(404).json({
            success: false,
            error: 'Partner not found',
          });
        }

        await PartnerProfile.deletePartnerProfile(prisma, req.params.id);

        // Audit log
        await auditService.logEntityDeleted(
          'PartnerProfile',
          req.params.id,
          req.params.id,
          req.user?.id
        );

        res.json({
          success: true,
          message: 'Partner deleted successfully',
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  // ========== Partner Registration Endpoints ==========

  /**
   * POST /api/partners/register
   * Register a new partner application
   */
  router.post(
    '/register',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const result = await registrationService.registerPartner(req.body);
        res.status(201).json({
          success: true,
          data: result,
        });
      } catch (error: any) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  // ========== Contact Person Endpoints ==========

  /**
   * POST /api/partners/:partnerId/contacts
   * Create a contact person for a partner
   */
  router.post(
    '/:partnerId/contacts',
    requireAuth,
    requireRole(['admin', 'partner_manager']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const input: ContactPerson.ContactPersonInput = {
          ...req.body,
          partnerId: req.params.partnerId,
        };
        const contact = await ContactPerson.createContactPerson(prisma, input);

        // Audit log
        await auditService.logContactPersonCreated(
          contact.id,
          req.params.partnerId,
          input as any,
          req.user?.id
        );

        res.status(201).json({
          success: true,
          data: contact,
        });
      } catch (error: any) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /api/partners/:partnerId/contacts
   * Get all contact persons for a partner
   */
  router.get(
    '/:partnerId/contacts',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const contacts = await ContactPerson.getContactPersonsByPartner(
          prisma,
          req.params.partnerId
        );
        res.json({
          success: true,
          data: contacts,
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * PATCH /api/partners/contacts/:id
   * Update a contact person
   */
  router.patch(
    '/contacts/:id',
    requireAuth,
    requireRole(['admin', 'partner_manager']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const oldContact = await ContactPerson.getContactPerson(prisma, req.params.id);
        if (!oldContact) {
          return res.status(404).json({
            success: false,
            error: 'Contact person not found',
          });
        }

        const updated = await ContactPerson.updateContactPerson(
          prisma,
          req.params.id,
          req.body
        );

        // Audit log
        await auditService.logContactPersonUpdated(
          req.params.id,
          oldContact.partnerId,
          oldContact as any,
          updated as any,
          req.user?.id
        );

        res.json({
          success: true,
          data: updated,
        });
      } catch (error: any) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * DELETE /api/partners/contacts/:id
   * Delete a contact person
   */
  router.delete(
    '/contacts/:id',
    requireAuth,
    requireRole(['admin', 'partner_manager']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const contact = await ContactPerson.getContactPerson(prisma, req.params.id);
        if (!contact) {
          return res.status(404).json({
            success: false,
            error: 'Contact person not found',
          });
        }

        await ContactPerson.deleteContactPerson(prisma, req.params.id);

        // Audit log
        await auditService.logEntityDeleted(
          'ContactPerson',
          req.params.id,
          contact.partnerId,
          req.user?.id
        );

        res.json({
          success: true,
          message: 'Contact person deleted successfully',
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  // ========== Partnership Agreement Endpoints ==========

  /**
   * POST /api/partners/:partnerId/agreements
   * Create a partnership agreement
   */
  router.post(
    '/:partnerId/agreements',
    requireAuth,
    requireRole(['admin', 'partner_manager']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const input: PartnershipAgreement.PartnershipAgreementInput = {
          ...req.body,
          partnerId: req.params.partnerId,
        };
        const agreement = await PartnershipAgreement.createPartnershipAgreement(
          prisma,
          input
        );

        // Audit log
        await auditService.logAgreementCreated(
          agreement.id,
          req.params.partnerId,
          input as any,
          req.user?.id
        );

        res.status(201).json({
          success: true,
          data: agreement,
        });
      } catch (error: any) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /api/partners/:partnerId/agreements
   * Get all agreements for a partner
   */
  router.get(
    '/:partnerId/agreements',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const agreements = await PartnershipAgreement.getPartnershipAgreementsByPartner(
          prisma,
          req.params.partnerId
        );
        res.json({
          success: true,
          data: agreements,
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * PATCH /api/partners/agreements/:id
   * Update a partnership agreement
   */
  router.patch(
    '/agreements/:id',
    requireAuth,
    requireRole(['admin', 'partner_manager']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const oldAgreement = await PartnershipAgreement.getPartnershipAgreement(
          prisma,
          req.params.id
        );
        if (!oldAgreement) {
          return res.status(404).json({
            success: false,
            error: 'Agreement not found',
          });
        }

        const updated = await PartnershipAgreement.updatePartnershipAgreement(
          prisma,
          req.params.id,
          req.body
        );

        // Audit log
        await auditService.logAgreementUpdated(
          req.params.id,
          oldAgreement.partnerId,
          oldAgreement as any,
          updated as any,
          req.user?.id
        );

        res.json({
          success: true,
          data: updated,
        });
      } catch (error: any) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  // ========== Partnership Policy Endpoints ==========

  /**
   * GET /api/partners/policies
   * Get all published partnership policies
   */
  router.get('/policies', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const publishedOnly = req.query.publishedOnly === 'true';
      const policies = await PartnershipPolicy.getPartnershipPolicies(prisma, {
        publishedOnly,
      });
      res.json({
        success: true,
        data: policies,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/partners/policies/:id
   * Get a specific policy
   */
  router.get('/policies/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const policy = await PartnershipPolicy.getPartnershipPolicy(prisma, req.params.id);
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
        error: error.message,
      });
    }
  });

  // ========== Audit Log Endpoints ==========

  /**
   * GET /api/partners/:id/audit-logs
   * Get audit logs for a partner
   */
  router.get(
    '/:id/audit-logs',
    requireAuth,
    requireRole(['admin', 'partner_manager', 'auditor']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const logs = await auditService.getPartnerAuditLogs(req.params.id);
        res.json({
          success: true,
          data: logs,
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  return router;
}

