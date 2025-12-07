/**
 * B121C-OPS-030: Operational audit: block-level hash evidence viewer endpoint
 *
 * Block hash visualized; copyable JSON; pagination works
 *
 * Acceptance Criteria:
 * - block hash visualized
 * - copyable JSON
 * - pagination works
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const blockEvidenceRouter = Router();

/**
 * GET /api/audit/blocks
 *
 * Returns paginated block-level hash evidence
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 20)
 * - q: Search query (optional)
 *
 * Response:
 * {
 *   blocks: Array<BlockHashEvidence>,
 *   pagination: {
 *     page: number,
 *     pageSize: number,
 *     total: number,
 *     totalPages: number
 *   }
 * }
 */
blockEvidenceRouter.get('/api/audit/blocks', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
    const searchQuery = (req.query.q as string) || '';

    // Calculate skip
    const skip = (page - 1) * pageSize;

    // Build where clause for search
    const where: any = {};
    if (searchQuery) {
      where.OR = [
        { chainTxHash: { contains: searchQuery, mode: 'insensitive' } },
        { type: { contains: searchQuery, mode: 'insensitive' } },
        { subjectNpi: { contains: searchQuery, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await prisma.auditEvent.count({ where });

    // Get paginated audit events with chain transaction hashes
    const auditEvents = await prisma.auditEvent.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: pageSize,
    });

    // Transform to block evidence format
    const blocks = auditEvents
      .filter((event) => event.chainTxHash) // Only include events with block hashes
      .map((event, index) => {
        // Extract block information from event data or chainTxHash
        const blockHash = event.chainTxHash || `hash-${event.id}`;
        const blockNumber = (event.data as any)?.blockNumber || Date.parse(event.createdAt.toString());
        const transactionHash = event.chainTxHash || `tx-${event.id}`;
        const merkleRoot = (event.data as any)?.merkleRoot;
        const parentHash = (event.data as any)?.parentHash;

        return {
          id: event.id,
          blockHash,
          blockNumber,
          transactionHash,
          timestamp: event.createdAt.toISOString(),
          evidenceType: event.type,
          metadata: {
            subjectNpi: event.subjectNpi,
            userId: event.userId,
            eventData: event.data,
          },
          merkleRoot,
          parentHash,
        };
      });

    const totalPages = Math.ceil(total / pageSize);

    res.json({
      blocks,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Block evidence endpoint error:', error);
    res.status(500).json({
      error: 'block_evidence_fetch_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/audit/blocks/:id
 *
 * Returns detailed block evidence for a specific block
 *
 * Response:
 * {
 *   id: string,
 *   blockHash: string,
 *   blockNumber: number,
 *   transactionHash: string,
 *   timestamp: string,
 *   evidenceType: string,
 *   metadata: Record<string, any>,
 *   merkleRoot?: string,
 *   parentHash?: string
 * }
 */
blockEvidenceRouter.get('/api/audit/blocks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const event = await prisma.auditEvent.findUnique({
      where: { id },
    });

    if (!event || !event.chainTxHash) {
      return res.status(404).json({
        error: 'not_found',
        error_description: 'Block evidence not found',
      });
    }

    const blockHash = event.chainTxHash;
    const blockNumber = (event.data as any)?.blockNumber || Date.parse(event.createdAt.toString());
    const transactionHash = event.chainTxHash;
    const merkleRoot = (event.data as any)?.merkleRoot;
    const parentHash = (event.data as any)?.parentHash;

    const block = {
      id: event.id,
      blockHash,
      blockNumber,
      transactionHash,
      timestamp: event.createdAt.toISOString(),
      evidenceType: event.type,
      metadata: {
        subjectNpi: event.subjectNpi,
        userId: event.userId,
        eventData: event.data,
      },
      merkleRoot,
      parentHash,
    };

    res.json(block);
  } catch (error) {
    console.error('Block evidence detail error:', error);
    res.status(500).json({
      error: 'block_evidence_fetch_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

