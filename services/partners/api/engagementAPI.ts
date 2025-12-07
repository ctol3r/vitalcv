/**
 * B248B-PARTNER-018: PartnershipAPI endpoints
 *
 * REST endpoints to create/list/update opportunities, proposals, campaigns, and tasks;
 * uses RBAC; includes pagination and filtering.
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PartnershipOpportunityService } from '../services/opportunityService';
import {
  validateCreatePartnershipOpportunity,
  validateUpdatePartnershipOpportunity,
} from '../models/PartnershipOpportunity';
import {
  validateCreatePartnershipProposal,
  validateUpdatePartnershipProposal,
} from '../models/PartnershipProposal';
import {
  validateCreateCoMarketingCampaign,
  validateUpdateCoMarketingCampaign,
} from '../models/CoMarketingCampaign';
import {
  validateCreateCollaborationTask,
  validateUpdateCollaborationTask,
} from '../models/CollaborationTask';
import {
  PartnerPermission,
  checkPermission,
  PartnerRole,
} from '../security/partnerRoles';
import { PartnerMetricsService } from '../analytics/partnerMetricsService';

const router = Router();
const prisma = new PrismaClient();

// Extend Request to include user
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
    partnerId?: string | null;
  };
}

// Middleware to load user (should be provided by auth middleware)
async function loadUser(req: AuthenticatedRequest, res: Response, next: Function) {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Get user's partner ID if they have one
    // This would typically come from a UserPartnerLink table or similar
    req.user = {
      id: user.id,
      email: user.email,
      roles: user.roles,
      partnerId: null, // TODO: Load from user-partner relationship
    };

    next();
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load user' });
  }
}

const opportunityService = new PartnershipOpportunityService(prisma);
const metricsService = new PartnerMetricsService(prisma);

// ==================== Opportunities ====================

/**
 * POST /api/partners/opportunities
 * Create a new partnership opportunity
 */
router.post(
  '/opportunities',
  loadUser,
  async (req: AuthenticatedRequest, res: Response) => {
    const permissionCheck = checkPermission(
      req.user!.roles,
      PartnerPermission.CREATE_OPPORTUNITY,
      req.user!.partnerId || null,
      req.body.partnerId,
    );

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: permissionCheck.reason });
    }

    try {
      const data = validateCreatePartnershipOpportunity({
        ...req.body,
        createdBy: req.user!.id,
      });

      const result = await opportunityService.createOpportunity(data);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
);

/**
 * GET /api/partners/opportunities
 * List opportunities with filtering and pagination
 */
router.get(
  '/opportunities',
  loadUser,
  async (req: AuthenticatedRequest, res: Response) => {
    const permissionCheck = checkPermission(
      req.user!.roles,
      PartnerPermission.READ_OPPORTUNITY,
    );

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: permissionCheck.reason });
    }

    try {
      const filters: any = {
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
      };

      if (req.query.partnerId) {
        filters.partnerId = req.query.partnerId as string;
      }

      if (req.query.status) {
        filters.status = req.query.status as string;
      }

      if (req.query.assignedTo) {
        filters.assignedTo = req.query.assignedTo as string;
      }

      // Partner users can only see their own partner's opportunities
      if (
        req.user!.partnerId &&
        !req.user!.roles.includes(PartnerRole.PARTNER_MANAGER)
      ) {
        filters.partnerId = req.user!.partnerId;
      }

      const result = await opportunityService.listOpportunities(filters);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * GET /api/partners/opportunities/:id
 * Get opportunity by ID
 */
router.get(
  '/opportunities/:id',
  loadUser,
  async (req: AuthenticatedRequest, res: Response) => {
    const permissionCheck = checkPermission(
      req.user!.roles,
      PartnerPermission.READ_OPPORTUNITY,
    );

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: permissionCheck.reason });
    }

    try {
      const opportunity = await opportunityService.getOpportunity(
        req.params.id,
      );

      if (!opportunity) {
        return res.status(404).json({ error: 'Opportunity not found' });
      }

      // Check partner access
      const accessCheck = checkPermission(
        req.user!.roles,
        PartnerPermission.READ_OPPORTUNITY,
        req.user!.partnerId || null,
        opportunity.partnerId,
      );

      if (!accessCheck.allowed) {
        return res.status(403).json({ error: accessCheck.reason });
      }

      res.json(opportunity);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * PATCH /api/partners/opportunities/:id
 * Update opportunity
 */
router.patch(
  '/opportunities/:id',
  loadUser,
  async (req: AuthenticatedRequest, res: Response) => {
    const permissionCheck = checkPermission(
      req.user!.roles,
      PartnerPermission.UPDATE_OPPORTUNITY,
    );

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: permissionCheck.reason });
    }

    try {
      const data = validateUpdatePartnershipOpportunity(req.body);
      await opportunityService.updateOpportunity(req.params.id, data);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
);

/**
 * POST /api/partners/opportunities/:id/assign
 * Assign owner to opportunity
 */
router.post(
  '/opportunities/:id/assign',
  loadUser,
  async (req: AuthenticatedRequest, res: Response) => {
    const permissionCheck = checkPermission(
      req.user!.roles,
      PartnerPermission.ASSIGN_OPPORTUNITY,
    );

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: permissionCheck.reason });
    }

    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      await opportunityService.assignOwner(req.params.id, userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
);

// ==================== Proposals ====================

/**
 * POST /api/partners/proposals
 * Create a new proposal
 */
router.post(
  '/proposals',
  loadUser,
  async (req: AuthenticatedRequest, res: Response) => {
    const permissionCheck = checkPermission(
      req.user!.roles,
      PartnerPermission.CREATE_PROPOSAL,
    );

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: permissionCheck.reason });
    }

    try {
      const data = validateCreatePartnershipProposal(req.body);
      const proposal = await prisma.partnershipProposal.create({ data });
      res.status(201).json(proposal);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
);

/**
 * GET /api/partners/proposals
 * List proposals
 */
router.get(
  '/proposals',
  loadUser,
  async (req: AuthenticatedRequest, res: Response) => {
    const permissionCheck = checkPermission(
      req.user!.roles,
      PartnerPermission.READ_PROPOSAL,
    );

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: permissionCheck.reason });
    }

    try {
      const where: any = {};
      if (req.query.opportunityId) {
        where.opportunityId = req.query.opportunityId as string;
      }
      if (req.query.status) {
        where.status = req.query.status as string;
      }

      const proposals = await prisma.partnershipProposal.findMany({
        where,
        take: parseInt(req.query.limit as string) || 50,
        skip: parseInt(req.query.offset as string) || 0,
        orderBy: { createdAt: 'desc' },
      });

      res.json({ proposals, total: proposals.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * PATCH /api/partners/proposals/:id
 * Update proposal
 */
router.patch(
  '/proposals/:id',
  loadUser,
  async (req: AuthenticatedRequest, res: Response) => {
    const permissionCheck = checkPermission(
      req.user!.roles,
      PartnerPermission.UPDATE_PROPOSAL,
    );

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: permissionCheck.reason });
    }

    try {
      const data = validateUpdatePartnershipProposal(req.body);
      const proposal = await prisma.partnershipProposal.update({
        where: { id: req.params.id },
        data,
      });
      res.json(proposal);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
);

// ==================== Campaigns ====================

/**
 * POST /api/partners/campaigns
 * Create a new campaign
 */
router.post(
  '/campaigns',
  loadUser,
  async (req: AuthenticatedRequest, res: Response) => {
    const permissionCheck = checkPermission(
      req.user!.roles,
      PartnerPermission.CREATE_CAMPAIGN,
      req.user!.partnerId || null,
      req.body.partnerId,
    );

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: permissionCheck.reason });
    }

    try {
      const data = validateCreateCoMarketingCampaign(req.body);
      const campaign = await prisma.coMarketingCampaign.create({ data });
      res.status(201).json(campaign);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
);

/**
 * GET /api/partners/campaigns
 * List campaigns
 */
router.get(
  '/campaigns',
  loadUser,
  async (req: AuthenticatedRequest, res: Response) => {
    const permissionCheck = checkPermission(
      req.user!.roles,
      PartnerPermission.READ_CAMPAIGN,
    );

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: permissionCheck.reason });
    }

    try {
      const where: any = {};
      if (req.query.partnerId) {
        where.partnerId = req.query.partnerId as string;
      }
      if (req.query.status) {
        where.status = req.query.status as string;
      }

      // Partner users can only see their own campaigns
      if (
        req.user!.partnerId &&
        !req.user!.roles.includes(PartnerRole.PARTNER_MANAGER)
      ) {
        where.partnerId = req.user!.partnerId;
      }

      const campaigns = await prisma.coMarketingCampaign.findMany({
        where,
        take: parseInt(req.query.limit as string) || 50,
        skip: parseInt(req.query.offset as string) || 0,
        orderBy: { createdAt: 'desc' },
      });

      res.json({ campaigns, total: campaigns.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * PATCH /api/partners/campaigns/:id
 * Update campaign
 */
router.patch(
  '/campaigns/:id',
  loadUser,
  async (req: AuthenticatedRequest, res: Response) => {
    const permissionCheck = checkPermission(
      req.user!.roles,
      PartnerPermission.UPDATE_CAMPAIGN,
    );

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: permissionCheck.reason });
    }

    try {
      const data = validateUpdateCoMarketingCampaign(req.body);
      const campaign = await prisma.coMarketingCampaign.update({
        where: { id: req.params.id },
        data,
      });
      res.json(campaign);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
);

// ==================== Tasks ====================

/**
 * POST /api/partners/tasks
 * Create a new task
 */
router.post(
  '/tasks',
  loadUser,
  async (req: AuthenticatedRequest, res: Response) => {
    const permissionCheck = checkPermission(
      req.user!.roles,
      PartnerPermission.CREATE_TASK,
      req.user!.partnerId || null,
      req.body.partnerId,
    );

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: permissionCheck.reason });
    }

    try {
      const data = validateCreateCollaborationTask(req.body);
      const task = await prisma.collaborationTask.create({ data });
      res.status(201).json(task);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
);

/**
 * GET /api/partners/tasks
 * List tasks
 */
router.get(
  '/tasks',
  loadUser,
  async (req: AuthenticatedRequest, res: Response) => {
    const permissionCheck = checkPermission(
      req.user!.roles,
      PartnerPermission.READ_TASK,
    );

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: permissionCheck.reason });
    }

    try {
      const where: any = {};
      if (req.query.partnerId) {
        where.partnerId = req.query.partnerId as string;
      }
      if (req.query.status) {
        where.status = req.query.status as string;
      }
      if (req.query.assignedTo) {
        where.assignedTo = req.query.assignedTo as string;
      }

      // Partner users can only see their own tasks
      if (
        req.user!.partnerId &&
        !req.user!.roles.includes(PartnerRole.PARTNER_MANAGER)
      ) {
        where.partnerId = req.user!.partnerId;
      }

      const tasks = await prisma.collaborationTask.findMany({
        where,
        take: parseInt(req.query.limit as string) || 50,
        skip: parseInt(req.query.offset as string) || 0,
        orderBy: { createdAt: 'desc' },
      });

      res.json({ tasks, total: tasks.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * PATCH /api/partners/tasks/:id
 * Update task
 */
router.patch(
  '/tasks/:id',
  loadUser,
  async (req: AuthenticatedRequest, res: Response) => {
    const permissionCheck = checkPermission(
      req.user!.roles,
      PartnerPermission.UPDATE_TASK,
    );

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: permissionCheck.reason });
    }

    try {
      const data = validateUpdateCollaborationTask(req.body);
      const task = await prisma.collaborationTask.update({
        where: { id: req.params.id },
        data,
      });
      res.json(task);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
);

// ==================== Metrics ====================

/**
 * GET /api/partners/metrics
 * Get partner metrics
 */
router.get(
  '/metrics',
  loadUser,
  async (req: AuthenticatedRequest, res: Response) => {
    const permissionCheck = checkPermission(
      req.user!.roles,
      PartnerPermission.READ_METRICS,
    );

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: permissionCheck.reason });
    }

    try {
      const partnerId = (req.query.partnerId as string) || req.user!.partnerId;
      if (!partnerId) {
        return res.status(400).json({ error: 'partnerId is required' });
      }

      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : new Date();

      const metrics = await metricsService.calculatePartnerMetrics(
        partnerId,
        startDate,
        endDate,
      );

      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * GET /api/partners/metrics/monthly
 * Get monthly report
 */
router.get(
  '/metrics/monthly',
  loadUser,
  async (req: AuthenticatedRequest, res: Response) => {
    const permissionCheck = checkPermission(
      req.user!.roles,
      PartnerPermission.READ_METRICS,
    );

    if (!permissionCheck.allowed) {
      return res.status(403).json({ error: permissionCheck.reason });
    }

    try {
      const partnerId = (req.query.partnerId as string) || req.user!.partnerId;
      if (!partnerId) {
        return res.status(400).json({ error: 'partnerId is required' });
      }

      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;

      const report = await metricsService.generateMonthlyReport(
        partnerId,
        year,
        month,
      );

      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

export default router;

