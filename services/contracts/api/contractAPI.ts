/**
 * B251B-CON-020: ContractAPI endpoints
 *
 * REST endpoints to create/list/update contracts, versions, parties, templates, change requests;
 * enforces RBAC; validates inputs; supports search queries; returns paginated results.
 */

import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { ContractService } from '../services/contractService.js';
import { ContractTemplateService } from '../services/contractTemplateService.js';
import { ContractPartyService } from '../services/contractPartyService.js';
import { ContractChangeRequestService } from '../services/contractChangeRequestService.js';
import { ContractSearchService } from '../services/contractSearchService.js';
import { requireAuth, requireRole } from '../../../backend/src/middlewares/guards.js';

const router = Router();

// Service instances
const contractService = new ContractService();
const templateService = new ContractTemplateService();
const partyService = new ContractPartyService();
const changeRequestService = new ContractChangeRequestService();
const searchService = new ContractSearchService();

// Validation schemas
const createContractSchema = z.object({
  templateId: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().min(1),
  type: z.enum(['NDA', 'SERVICE', 'PARTNERSHIP', 'EMPLOYMENT', 'VENDOR', 'OTHER']),
  variables: z.record(z.string()).optional(),
  effectiveDate: z.string().datetime().optional(),
  expirationDate: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

const updateContractSchema = z.object({
  title: z.string().min(1).optional(),
  metadata: z.record(z.any()).optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  language: z.string().default('en'),
  content: z.string().min(1),
  variables: z.array(z.string()).optional(),
  versionNumber: z.string().optional(),
});

const updateTemplateSchema = createTemplateSchema.partial();

const addPartySchema = z.object({
  organizationId: z.string().optional(),
  partnerId: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email(),
  role: z.enum(['SIGNER', 'WITNESS', 'OBSERVER']),
});

const createChangeRequestSchema = z.object({
  changeSummary: z.string().min(1),
  proposedChanges: z.record(z.any()).optional(),
});

const approveChangeRequestSchema = z.object({
  newVersionContent: z.string().optional(),
  changeSummary: z.string().optional(),
});

const searchQuerySchema = z.object({
  query: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  authorId: z.string().optional(),
  partyId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Helper to get user ID from request
 */
function getUserId(req: Request): string {
  return (req as any).user?.id || req.headers['x-user-id'] as string || '';
}

/**
 * Helper to check if user has access to contract
 */
async function checkContractAccess(
  userId: string,
  contractId: string
): Promise<boolean> {
  try {
    const contract = await contractService.getContract(contractId);
    if (!contract) return false;

    // User can access if they are the author or a party
    if (contract.authorId === userId) return true;

    const parties = await partyService.getParties(contractId);
    return parties.some(
      (p) => p.contactEmail === userId || p.organizationId === userId
    );
  } catch {
    return false;
  }
}

// ==================== Contract Endpoints ====================

/**
 * POST /api/contracts
 * Create a new contract from template
 */
router.post(
  '/',
  requireAuth,
  requireRole('admin', 'contract_manager'),
  async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const data = createContractSchema.parse(req.body);

      const contract = await contractService.createContract({
        ...data,
        authorId: userId,
        effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : undefined,
        expirationDate: data.expirationDate ? new Date(data.expirationDate) : undefined,
      });

      return res.status(201).json({ contract });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Error creating contract:', error);
      return res.status(500).json({ error: 'Failed to create contract', details: error.message });
    }
  }
);

/**
 * GET /api/contracts
 * List contracts with filters and pagination
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const query = searchQuerySchema.parse(req.query);

    const result = await contractService.listContracts({
      authorId: query.authorId || userId,
      status: query.status as any,
      type: query.type as any,
      limit: query.limit,
      offset: query.offset,
    });

    return res.json({
      contracts: result.contracts,
      pagination: {
        total: result.total,
        limit: query.limit,
        offset: query.offset,
        hasMore: result.total > query.offset + query.limit,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    console.error('Error listing contracts:', error);
    return res.status(500).json({ error: 'Failed to list contracts', details: error.message });
  }
});

/**
 * GET /api/contracts/search
 * Search contracts with full-text search
 */
router.get('/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const query = searchQuerySchema.parse(req.query);

    const result = await searchService.search({
      query: query.query,
      status: query.status as any,
      type: query.type as any,
      authorId: query.authorId,
      partyId: query.partyId,
      tags: query.tags,
      limit: query.limit,
      offset: query.offset,
    });

    return res.json({
      contracts: result.contracts,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.total > result.offset + result.limit,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    console.error('Error searching contracts:', error);
    return res.status(500).json({ error: 'Failed to search contracts', details: error.message });
  }
});

/**
 * GET /api/contracts/:id
 * Get contract by ID
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!(await checkContractAccess(userId, id))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const contract = await contractService.getContract(id);

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    return res.json({ contract });
  } catch (error: any) {
    console.error('Error getting contract:', error);
    return res.status(500).json({ error: 'Failed to get contract', details: error.message });
  }
});

/**
 * PATCH /api/contracts/:id
 * Update contract metadata
 */
router.patch(
  '/:id',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);

      if (!(await checkContractAccess(userId, id))) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const data = updateContractSchema.parse(req.body);

      const contract = await contractService.updateContract(id, userId, data);

      return res.json({ contract });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Error updating contract:', error);
      return res.status(500).json({ error: 'Failed to update contract', details: error.message });
    }
  }
);

/**
 * POST /api/contracts/:id/publish
 * Publish contract (set status to UNDER_REVIEW)
 */
router.post(
  '/:id/publish',
  requireAuth,
  requireRole('admin', 'contract_manager'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);

      if (!(await checkContractAccess(userId, id))) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const contract = await contractService.publishContract(id, userId);

      return res.json({ contract });
    } catch (error: any) {
      console.error('Error publishing contract:', error);
      return res.status(500).json({ error: 'Failed to publish contract', details: error.message });
    }
  }
);

/**
 * POST /api/contracts/:id/activate
 * Activate contract (set status to ACTIVE)
 */
router.post(
  '/:id/activate',
  requireAuth,
  requireRole('admin', 'contract_manager'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);

      if (!(await checkContractAccess(userId, id))) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const contract = await contractService.activateContract(id, userId);

      return res.json({ contract });
    } catch (error: any) {
      console.error('Error activating contract:', error);
      return res.status(500).json({ error: 'Failed to activate contract', details: error.message });
    }
  }
);

/**
 * POST /api/contracts/:id/terminate
 * Terminate contract
 */
router.post(
  '/:id/terminate',
  requireAuth,
  requireRole('admin', 'contract_manager'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const { reason } = req.body;

      if (!(await checkContractAccess(userId, id))) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const contract = await contractService.terminateContract(id, userId, reason);

      return res.json({ contract });
    } catch (error: any) {
      console.error('Error terminating contract:', error);
      return res.status(500).json({ error: 'Failed to terminate contract', details: error.message });
    }
  }
);

// ==================== Version Endpoints ====================

/**
 * GET /api/contracts/:id/versions
 * List versions for a contract
 */
router.get('/:id/versions', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!(await checkContractAccess(userId, id))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const contract = await contractService.getContract(id);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    return res.json({ versions: contract.versions });
  } catch (error: any) {
    console.error('Error getting versions:', error);
    return res.status(500).json({ error: 'Failed to get versions', details: error.message });
  }
});

// ==================== Party Endpoints ====================

/**
 * POST /api/contracts/:id/parties
 * Add a party to a contract
 */
router.post(
  '/:id/parties',
  requireAuth,
  requireRole('admin', 'contract_manager'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);

      if (!(await checkContractAccess(userId, id))) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const data = addPartySchema.parse(req.body);

      const party = await partyService.addParty({
        contractId: id,
        ...data,
      });

      return res.status(201).json({ party });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Error adding party:', error);
      return res.status(500).json({ error: 'Failed to add party', details: error.message });
    }
  }
);

/**
 * GET /api/contracts/:id/parties
 * Get parties for a contract
 */
router.get('/:id/parties', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!(await checkContractAccess(userId, id))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const parties = await partyService.getParties(id);

    return res.json({ parties });
  } catch (error: any) {
    console.error('Error getting parties:', error);
    return res.status(500).json({ error: 'Failed to get parties', details: error.message });
  }
});

/**
 * DELETE /api/contracts/:id/parties/:partyId
 * Remove a party from a contract
 */
router.delete(
  '/:id/parties/:partyId',
  requireAuth,
  requireRole('admin', 'contract_manager'),
  async (req: Request, res: Response) => {
    try {
      const { id, partyId } = req.params;
      const userId = getUserId(req);

      if (!(await checkContractAccess(userId, id))) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await partyService.removeParty(partyId, userId);

      return res.status(204).send();
    } catch (error: any) {
      console.error('Error removing party:', error);
      return res.status(500).json({ error: 'Failed to remove party', details: error.message });
    }
  }
);

// ==================== Template Endpoints ====================

/**
 * POST /api/contracts/templates
 * Create a contract template
 */
router.post(
  '/templates',
  requireAuth,
  requireRole('admin', 'contract_manager'),
  async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const data = createTemplateSchema.parse(req.body);

      const template = await templateService.createTemplate({
        ...data,
        createdBy: userId,
      });

      return res.status(201).json({ template });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Error creating template:', error);
      return res.status(500).json({ error: 'Failed to create template', details: error.message });
    }
  }
);

/**
 * GET /api/contracts/templates
 * List contract templates
 */
router.get('/templates', requireAuth, async (req: Request, res: Response) => {
  try {
    const { language, search, limit, offset } = req.query;

    const result = await templateService.listTemplates({
      language: language as string,
      search: search as string,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });

    return res.json({
      templates: result.templates,
      pagination: {
        total: result.total,
        limit: limit ? Number(limit) : 50,
        offset: offset ? Number(offset) : 0,
      },
    });
  } catch (error: any) {
    console.error('Error listing templates:', error);
    return res.status(500).json({ error: 'Failed to list templates', details: error.message });
  }
});

/**
 * GET /api/contracts/templates/:id
 * Get template by ID
 */
router.get('/templates/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const template = await templateService.getTemplate(id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    return res.json({ template });
  } catch (error: any) {
    console.error('Error getting template:', error);
    return res.status(500).json({ error: 'Failed to get template', details: error.message });
  }
});

/**
 * PATCH /api/contracts/templates/:id
 * Update a contract template
 */
router.patch(
  '/templates/:id',
  requireAuth,
  requireRole('admin', 'contract_manager'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = updateTemplateSchema.parse(req.body);

      const template = await templateService.updateTemplate(id, data);

      return res.json({ template });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Error updating template:', error);
      return res.status(500).json({ error: 'Failed to update template', details: error.message });
    }
  }
);

/**
 * DELETE /api/contracts/templates/:id
 * Delete a contract template
 */
router.delete(
  '/templates/:id',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      await templateService.deleteTemplate(id);

      return res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      return res.status(500).json({ error: 'Failed to delete template', details: error.message });
    }
  }
);

// ==================== Change Request Endpoints ====================

/**
 * POST /api/contracts/:id/change-requests
 * Create a change request
 */
router.post(
  '/:id/change-requests',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);

      if (!(await checkContractAccess(userId, id))) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const data = createChangeRequestSchema.parse(req.body);

      const changeRequest = await changeRequestService.createChangeRequest({
        contractId: id,
        requestedBy: userId,
        ...data,
      });

      return res.status(201).json({ changeRequest });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Error creating change request:', error);
      return res.status(500).json({ error: 'Failed to create change request', details: error.message });
    }
  }
);

/**
 * GET /api/contracts/:id/change-requests
 * List change requests for a contract
 */
router.get('/:id/change-requests', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!(await checkContractAccess(userId, id))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const changeRequests = await changeRequestService.listChangeRequests(id);

    return res.json({ changeRequests });
  } catch (error: any) {
    console.error('Error listing change requests:', error);
    return res.status(500).json({ error: 'Failed to list change requests', details: error.message });
  }
});

/**
 * POST /api/contracts/change-requests/:id/approve
 * Approve a change request
 */
router.post(
  '/change-requests/:id/approve',
  requireAuth,
  requireRole('admin', 'contract_manager'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const data = approveChangeRequestSchema.parse(req.body);

      const changeRequest = await changeRequestService.approveChangeRequest({
        changeRequestId: id,
        approvedBy: userId,
        ...data,
      });

      return res.json({ changeRequest });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Error approving change request:', error);
      return res.status(500).json({ error: 'Failed to approve change request', details: error.message });
    }
  }
);

/**
 * POST /api/contracts/change-requests/:id/reject
 * Reject a change request
 */
router.post(
  '/change-requests/:id/reject',
  requireAuth,
  requireRole('admin', 'contract_manager'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const { reason } = req.body;

      const changeRequest = await changeRequestService.rejectChangeRequest(id, userId, reason);

      return res.json({ changeRequest });
    } catch (error: any) {
      console.error('Error rejecting change request:', error);
      return res.status(500).json({ error: 'Failed to reject change request', details: error.message });
    }
  }
);

export default router;

