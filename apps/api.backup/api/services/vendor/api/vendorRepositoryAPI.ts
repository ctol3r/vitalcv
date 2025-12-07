/**
 * B240A-VM-008: VendorRepository API
 *
 * Exposes endpoints to list, create, update, and archive vendors; supports
 * filtering by category, status, and risk level; implements pagination and
 * sorting; enforces RBAC
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, VendorStatus } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import { VendorProfileService } from '../services/vendorProfileService.js';
import { ContractManagementService } from '../services/contractManagementService.js';
import {
  uploadVendorDocument,
  listVendorDocuments,
  getVendorDocument,
  retrieveVendorDocumentFile,
} from '../storage/vendorDocumentStorage.js';
import {
  createVendorContact,
  getVendorContacts,
  updateVendorContact,
  deleteVendorContact,
} from '../models/VendorContact.js';
import {
  getVendorOnboardingFlow,
  updateVendorOnboardingFlow,
  completeChecklistItem,
} from '../models/VendorOnboardingFlow.js';

const router = Router();
const prisma = new PrismaClient();
const log = getServiceLogger('vendor/api/repository');

const vendorService = new VendorProfileService(prisma);
const contractService = new ContractManagementService(prisma);

/**
 * RBAC: Check if user has permission to access vendor resources
 */
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
    orgId?: string;
  };
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthRequest;
  if (!authReq.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasRole = roles.some((role) => authReq.user!.roles.includes(role));
    if (!hasRole) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: authReq.user.roles,
      });
    }

    next();
  };
}

/**
 * Check if user can access vendor (must be in same org or have admin role)
 */
async function checkVendorAccess(
  vendorId: string,
  userOrgId: string | undefined,
  userRoles: string[]
): Promise<boolean> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { orgId: true },
  });

  if (!vendor) {
    return false;
  }

  // Admin can access any vendor
  if (userRoles.includes('admin') || userRoles.includes('vendor_admin')) {
    return true;
  }

  // User must be in same org
  return vendor.orgId === userOrgId;
}

/**
 * GET /api/vendors
 * List vendors with filtering, pagination, and sorting
 */
router.get(
  '/',
  requireAuth,
  requireRole('vendor_viewer', 'vendor_admin', 'admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        orgId,
        categoryId,
        status,
        riskLevel,
        search,
        page = '1',
        limit = '20',
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      // Use user's orgId if not provided and user is not admin
      const targetOrgId =
        orgId || (req.user?.roles.includes('admin') ? undefined : req.user?.orgId);

      if (!targetOrgId && !req.user?.roles.includes('admin')) {
        return res.status(400).json({ error: 'orgId is required' });
      }

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;

      // Build where clause
      const where: any = {};
      if (targetOrgId) {
        where.orgId = targetOrgId;
      }
      if (categoryId) {
        where.categoryId = categoryId as string;
      }
      if (status) {
        where.status = status as VendorStatus;
      }
      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { description: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      // TODO: Add risk level filtering when risk scores are implemented
      // if (riskLevel) {
      //   where.riskScores = {
      //     some: {
      //       level: riskLevel,
      //     },
      //   };
      // }

      // Get vendors
      const [vendors, total] = await Promise.all([
        prisma.vendor.findMany({
          where,
          skip: offset,
          take: limitNum,
          orderBy: { [sortBy as string]: sortOrder as 'asc' | 'desc' },
          include: {
            category: {
              select: {
                id: true,
                name: true,
              },
            },
            primaryContact: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
            _count: {
              select: {
                contacts: true,
                documents: true,
                contracts: true,
              },
            },
          },
        }),
        prisma.vendor.count({ where }),
      ]);

      res.json({
        vendors,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error: any) {
      log.error('[GET /api/vendors] Error', { error });
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
);

/**
 * GET /api/vendors/:id
 * Get vendor by ID with related data
 */
router.get(
  '/:id',
  requireAuth,
  requireRole('vendor_viewer', 'vendor_admin', 'admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Check access
      const hasAccess = await checkVendorAccess(
        id,
        req.user?.orgId,
        req.user?.roles || []
      );
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const vendor = await vendorService.getVendorWithRelations(id);
      if (!vendor) {
        return res.status(404).json({ error: 'Vendor not found' });
      }

      res.json(vendor);
    } catch (error: any) {
      log.error('[GET /api/vendors/:id] Error', { error });
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
);

/**
 * POST /api/vendors
 * Create new vendor
 */
router.post(
  '/',
  requireAuth,
  requireRole('vendor_admin', 'admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        name,
        categoryId,
        status,
        description,
        website,
        primaryContactId,
      } = req.body;

      const orgId = req.body.orgId || req.user?.orgId;
      if (!orgId) {
        return res.status(400).json({ error: 'orgId is required' });
      }

      // Check if user can create vendor for this org
      if (orgId !== req.user?.orgId && !req.user?.roles.includes('admin')) {
        return res.status(403).json({ error: 'Cannot create vendor for other organization' });
      }

      const vendor = await vendorService.createVendorProfile(orgId, {
        name,
        categoryId,
        status,
        description,
        website,
        primaryContactId,
      });

      res.status(201).json(vendor);
    } catch (error: any) {
      log.error('[POST /api/vendors] Error', { error });
      res.status(400).json({ error: error.message || 'Bad request' });
    }
  }
);

/**
 * PATCH /api/vendors/:id
 * Update vendor
 */
router.patch(
  '/:id',
  requireAuth,
  requireRole('vendor_admin', 'admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Check access
      const hasAccess = await checkVendorAccess(
        id,
        req.user?.orgId,
        req.user?.roles || []
      );
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const vendor = await vendorService.updateVendorProfile(id, req.body);
      res.json(vendor);
    } catch (error: any) {
      log.error('[PATCH /api/vendors/:id] Error', { error });
      res.status(400).json({ error: error.message || 'Bad request' });
    }
  }
);

/**
 * DELETE /api/vendors/:id
 * Archive vendor (set status to INACTIVE)
 */
router.delete(
  '/:id',
  requireAuth,
  requireRole('vendor_admin', 'admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Check access
      const hasAccess = await checkVendorAccess(
        id,
        req.user?.orgId,
        req.user?.roles || []
      );
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const vendor = await vendorService.archiveVendorProfile(id);
      res.json({ message: 'Vendor archived', vendor });
    } catch (error: any) {
      log.error('[DELETE /api/vendors/:id] Error', { error });
      res.status(400).json({ error: error.message || 'Bad request' });
    }
  }
);

/**
 * GET /api/vendors/:id/contacts
 * List vendor contacts
 */
router.get(
  '/:id/contacts',
  requireAuth,
  requireRole('vendor_viewer', 'vendor_admin', 'admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Check access
      const hasAccess = await checkVendorAccess(
        id,
        req.user?.orgId,
        req.user?.roles || []
      );
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const contacts = await getVendorContacts(prisma, id);
      res.json(contacts);
    } catch (error: any) {
      log.error('[GET /api/vendors/:id/contacts] Error', { error });
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
);

/**
 * POST /api/vendors/:id/contacts
 * Create vendor contact
 */
router.post(
  '/:id/contacts',
  requireAuth,
  requireRole('vendor_admin', 'admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, role, email, phone } = req.body;

      // Check access
      const hasAccess = await checkVendorAccess(
        id,
        req.user?.orgId,
        req.user?.roles || []
      );
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const contact = await createVendorContact(prisma, {
        vendorId: id,
        name,
        role,
        email,
        phone,
      });

      res.status(201).json(contact);
    } catch (error: any) {
      log.error('[POST /api/vendors/:id/contacts] Error', { error });
      res.status(400).json({ error: error.message || 'Bad request' });
    }
  }
);

/**
 * GET /api/vendors/:id/documents
 * List vendor documents
 */
router.get(
  '/:id/documents',
  requireAuth,
  requireRole('vendor_viewer', 'vendor_admin', 'admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { docType } = req.query;

      // Check access
      const hasAccess = await checkVendorAccess(
        id,
        req.user?.orgId,
        req.user?.roles || []
      );
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const documents = await listVendorDocuments(prisma, id, {
        docType: docType as any,
      });

      res.json(documents);
    } catch (error: any) {
      log.error('[GET /api/vendors/:id/documents] Error', { error });
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
);

/**
 * GET /api/vendors/:id/onboarding
 * Get vendor onboarding flow
 */
router.get(
  '/:id/onboarding',
  requireAuth,
  requireRole('vendor_viewer', 'vendor_admin', 'admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Check access
      const hasAccess = await checkVendorAccess(
        id,
        req.user?.orgId,
        req.user?.roles || []
      );
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const flow = await getVendorOnboardingFlow(prisma, id);
      if (!flow) {
        return res.status(404).json({ error: 'Onboarding flow not found' });
      }

      res.json(flow);
    } catch (error: any) {
      log.error('[GET /api/vendors/:id/onboarding] Error', { error });
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
);

/**
 * GET /api/vendors/:id/contracts
 * List vendor contracts
 */
router.get(
  '/:id/contracts',
  requireAuth,
  requireRole('vendor_viewer', 'vendor_admin', 'admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status, activeOnly } = req.query;

      // Check access
      const hasAccess = await checkVendorAccess(
        id,
        req.user?.orgId,
        req.user?.roles || []
      );
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const contracts = await contractService.listVendorContracts(id, {
        status: status as any,
        activeOnly: activeOnly === 'true',
      });

      res.json(contracts);
    } catch (error: any) {
      log.error('[GET /api/vendors/:id/contracts] Error', { error });
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
);

export default router;

