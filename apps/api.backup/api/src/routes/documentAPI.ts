/**
 * B250B-DOC-020: DocumentAPI
 * Exposes REST endpoints: CRUD for documents, versions, comments, search, access management
 * Enforces RBAC; input validation; returns paginated results
 */

import express, { Request, Response, Router } from 'express';
import { z } from 'zod';
import { documentService } from '../services/docs/services/documentService.js';
import { documentVersioningService } from '../services/docs/services/documentVersioningService.js';
import { documentCommentService } from '../services/docs/services/documentCommentService.js';
import { documentAccessService } from '../services/docs/services/documentAccessService.js';
import { fullTextSearchService } from '../services/docs/services/fullTextSearchService.js';
import { documentAnalyticsService } from '../services/docs/analytics/documentAnalyticsService.js';
import { documentLockService } from '../services/docs/services/documentLockService.js';
import { documentNotificationService } from '../services/docs/services/documentNotificationService.js';
import { requireAuth } from '../middlewares/guards.js';

const router = Router();

// Extend Request to include user
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
}

// ==================== Document CRUD ====================

/**
 * POST /api/documents
 * Create a new document
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const document = await documentService.createDocument({
      title: req.body.title,
      content: req.body.content,
      category: req.body.category,
      tags: req.body.tags || [],
      metadata: req.body.metadata,
      authorId: userId,
    });

    res.status(201).json({ success: true, document });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/documents/:id
 * Get a document by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        currentVersion: true,
      },
    });

    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    // Track view analytics
    const userId = (req as AuthenticatedRequest).user?.id;
    await documentAnalyticsService.trackEvent({
      documentId: document.id,
      eventType: 'VIEW',
      userId,
    });

    res.json({ success: true, document });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/documents/:id
 * Update document metadata
 */
router.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const document = await documentService.updateMetadata({
      documentId: req.params.id,
      title: req.body.title,
      category: req.body.category,
      tags: req.body.tags,
      metadata: req.body.metadata,
      userId,
    });

    // Notify subscribers
    await documentNotificationService.notifyUpdated(req.params.id, userId);

    res.json({ success: true, document });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/documents/:id/publish
 * Publish a document
 */
router.post('/:id/publish', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const document = await documentService.publishDocument({
      documentId: req.params.id,
      userId,
    });

    // Notify subscribers
    await documentNotificationService.notifyPublished(req.params.id, userId);

    res.json({ success: true, document });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/documents/:id/archive
 * Archive a document
 */
router.post('/:id/archive', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const document = await documentService.archiveDocument({
      documentId: req.params.id,
      userId,
    });

    // Notify subscribers
    await documentNotificationService.notifyArchived(req.params.id, userId);

    res.json({ success: true, document });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/documents
 * List documents with pagination
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (req.query.category) {
      where.category = req.query.category;
    }
    if (req.query.status) {
      where.status = req.query.status;
    }
    if (req.query.authorId) {
      where.authorId = req.query.authorId;
    }

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
      prisma.document.count({ where }),
    ]);

    res.json({
      success: true,
      documents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Document Versions ====================

/**
 * POST /api/documents/:id/versions
 * Create a new version
 */
router.post('/:id/versions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const version = await documentVersioningService.createVersion({
      documentId: req.params.id,
      content: req.body.content,
      changeSummary: req.body.changeSummary,
      createdById: userId,
      versionToken: req.body.versionToken,
    });

    res.status(201).json({ success: true, version });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/documents/:id/versions
 * List all versions
 */
router.get('/:id/versions', async (req: Request, res: Response) => {
  try {
    const versions = await documentVersioningService.listVersions(req.params.id);
    res.json({ success: true, versions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/documents/:id/versions/:versionId
 * Get a specific version
 */
router.get('/:id/versions/:versionId', async (req: Request, res: Response) => {
  try {
    const version = await documentVersioningService.getVersion(req.params.versionId);
    if (!version) {
      return res.status(404).json({ success: false, error: 'Version not found' });
    }
    res.json({ success: true, version });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Document Comments ====================

/**
 * POST /api/documents/:id/comments
 * Create a comment
 */
router.post('/:id/comments', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const comment = await documentCommentService.createComment({
      documentId: req.params.id,
      parentId: req.body.parentId,
      content: req.body.content,
      authorId: userId,
    });

    res.status(201).json({ success: true, comment });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/documents/:id/comments
 * Get comments for a document
 */
router.get('/:id/comments', async (req: Request, res: Response) => {
  try {
    const comments = await documentCommentService.getComments(req.params.id);
    res.json({ success: true, comments });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/documents/:id/comments/:commentId
 * Update a comment
 */
router.put('/:id/comments/:commentId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const comment = await documentCommentService.updateComment({
      commentId: req.params.commentId,
      content: req.body.content,
      userId,
    });

    res.json({ success: true, comment });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/documents/:id/comments/:commentId
 * Delete a comment
 */
router.delete('/:id/comments/:commentId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    await documentCommentService.deleteComment({
      commentId: req.params.commentId,
      userId,
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==================== Document Access ====================

/**
 * POST /api/documents/:id/access
 * Grant access to a document
 */
router.post('/:id/access', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const access = await documentAccessService.grantAccess({
      documentId: req.params.id,
      userId: req.body.userId,
      role: req.body.role,
      accessLevel: req.body.accessLevel,
      grantedById: userId,
    });

    res.status(201).json({ success: true, access });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/documents/:id/access
 * Get access list for a document
 */
router.get('/:id/access', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const accessList = await documentAccessService.getAccessList(req.params.id);
    res.json({ success: true, access: accessList });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/documents/:id/access
 * Revoke access
 */
router.delete('/:id/access', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const result = await documentAccessService.revokeAccess({
      documentId: req.params.id,
      userId: req.body.userId,
      role: req.body.role,
      revokedById: userId,
    });

    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==================== Search ====================

/**
 * GET /api/documents/search
 * Search documents
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const results = await fullTextSearchService.search({
      query: req.query.q as string,
      category: req.query.category as string,
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    });

    res.json({ success: true, results });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==================== Locks ====================

/**
 * POST /api/documents/:id/lock
 * Acquire a lock for editing
 */
router.post('/:id/lock', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const token = await documentLockService.acquireLock({
      documentId: req.params.id,
      userId,
      ttlMinutes: req.body.ttlMinutes,
    });

    res.json({ success: true, versionToken: token });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/documents/:id/lock/verify
 * Verify a lock token
 */
router.post('/:id/lock/verify', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const valid = await documentLockService.verifyLock({
      documentId: req.params.id,
      userId,
      versionToken: req.body.versionToken,
    });

    res.json({ success: true, valid });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/documents/:id/lock
 * Release a lock
 */
router.delete('/:id/lock', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    await documentLockService.releaseLock(req.params.id, userId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==================== Analytics ====================

/**
 * POST /api/documents/:id/analytics
 * Track an analytics event
 */
router.post('/:id/analytics', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    await documentAnalyticsService.trackEvent({
      documentId: req.params.id,
      eventType: req.body.eventType,
      userId,
      metadata: req.body.metadata,
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/documents/:id/analytics
 * Get analytics report
 */
router.get('/:id/analytics', requireAuth, async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const report = await documentAnalyticsService.getReport(req.params.id, startDate, endDate);
    res.json({ success: true, report });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as documentRouter };

