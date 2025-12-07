/**
 * B114C-EVID-029: Evidence Registry API
 *
 * Provides endpoints for querying evidence records (peer-reviewed studies)
 * with support for DOI lookup, tag filtering, and KPI linkage.
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const evidenceRegistryRouter = Router();

/**
 * GET /api/evidence/registry
 *
 * List evidence records with optional filtering
 *
 * Query params:
 * - tag: Filter by tag (e.g., "ambient-AI")
 * - journal: Filter by journal (e.g., "JAMA")
 * - kpiReference: Filter by KPI reference (e.g., "minutesInNotes")
 */
evidenceRegistryRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { tag, journal, kpiReference } = req.query;

    const where: any = {};

    if (tag) {
      where.metadata = {
        path: ['tags'],
        array_contains: [tag],
      };
    }

    if (journal) {
      where.journal = journal;
    }

    if (kpiReference) {
      where.metadata = {
        ...where.metadata,
        path: ['kpiReference'],
        equals: kpiReference,
      };
    }

    const evidence = await prisma.evidence.findMany({
      where,
      orderBy: {
        publishedAt: 'desc',
      },
    });

    res.json({
      evidence: evidence.map((e) => ({
        id: e.id,
        doi: e.doi,
        title: e.title,
        abstract: e.abstract,
        authors: e.authors,
        journal: e.journal,
        publishedAt: e.publishedAt,
        hash: e.hash,
        chainTxHash: e.chainTxHash,
        metadata: e.metadata,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      })),
      count: evidence.length,
    });
  } catch (error) {
    console.error('Evidence registry lookup error:', error);
    res.status(500).json({
      error: 'lookup_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/evidence/registry/kpi/:kpiReference
 *
 * B120C-EVID-030: Get evidence linked to a KPI reference
 * Returns evidence record that supports a specific KPI metric
 *
 * Query params:
 * - kpiReference: KPI identifier (e.g., "minutes-in-notes")
 */
evidenceRegistryRouter.get('/kpi/:kpiReference', async (req: Request, res: Response) => {
  try {
    const { kpiReference } = req.params;

    // Find evidence with matching kpiReference in metadata
    const evidence = await prisma.evidence.findFirst({
      where: {
        metadata: {
          path: ['kpiReference'],
          equals: kpiReference,
        },
      },
      orderBy: {
        publishedAt: 'desc',
      },
    });

    if (!evidence) {
      return res.status(404).json({
        error: 'not_found',
        error_description: `No evidence found for KPI reference: ${kpiReference}`,
      });
    }

    res.json({
      id: evidence.id,
      doi: evidence.doi,
      title: evidence.title,
      abstract: evidence.abstract,
      authors: evidence.authors,
      journal: evidence.journal,
      publishedAt: evidence.publishedAt,
      hash: evidence.hash,
      chainTxHash: evidence.chainTxHash,
      metadata: evidence.metadata,
      createdAt: evidence.createdAt,
      updatedAt: evidence.updatedAt,
      kpiReference,
      kpiLink: `/api/evidence/registry/kpi/${kpiReference}`,
    });
  } catch (error) {
    console.error('KPI evidence lookup error:', error);
    res.status(500).json({
      error: 'lookup_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/evidence/registry/:id
 *
 * Get a single evidence record by ID
 */
evidenceRegistryRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const evidence = await prisma.evidence.findUnique({
      where: { id },
    });

    if (!evidence) {
      return res.status(404).json({
        error: 'not_found',
        error_description: 'Evidence record not found',
      });
    }

    res.json({
      id: evidence.id,
      doi: evidence.doi,
      title: evidence.title,
      abstract: evidence.abstract,
      authors: evidence.authors,
      journal: evidence.journal,
      publishedAt: evidence.publishedAt,
      hash: evidence.hash,
      chainTxHash: evidence.chainTxHash,
      metadata: evidence.metadata,
      createdAt: evidence.createdAt,
      updatedAt: evidence.updatedAt,
    });
  } catch (error) {
    console.error('Evidence registry lookup error:', error);
    res.status(500).json({
      error: 'lookup_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

