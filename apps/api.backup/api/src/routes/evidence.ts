import { Router } from 'express';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { PolkadotService } from '../blockchain/polkadot_service';

const prisma = new PrismaClient();
export const evidenceRouter = Router();

evidenceRouter.get('/ocr/:fileId', async (req, res) => {
  /* proxy to OCR or return demo text */
  res.json({ fileId: req.params.fileId, text: 'Demo OCR text …' });
});

evidenceRouter.get('/anchors', async (_req, res) => {
  const r = await fetch('http://localhost:4000/api/audit-chain/anchors')
    .then(r => r.json())
    .catch(() => ({ roots: [], events: [] }));
  res.json(r);
});

evidenceRouter.get('/statusbit', async (req, res) => {
  const idx = Number(req.query.index || 0);
  const r = await fetch('http://localhost:4000/status/1/bit?index=' + idx)
    .then(r => r.json())
    .catch(() => ({ index: idx, revoked: false }));
  res.json(r);
});

/**
 * B104C-EVID-041: Evidence Registry API
 * GET /api/evidence/registry - List all evidence entries
 * GET /api/evidence/registry/:id - Get evidence by ID
 * GET /api/evidence/registry/doi/:doi - Get evidence by DOI
 */
evidenceRouter.get('/registry', async (req, res) => {
  try {
    const { journal, tag } = req.query;
    const where: any = {};

    if (journal) {
      where.journal = journal;
    }

    // Fetch all evidence first, then filter by tag if needed
    // (Prisma JSON filtering can be complex, so we filter in memory)
    let evidence = await prisma.evidence.findMany({
      where: journal ? { journal: journal as string } : undefined,
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        doi: true,
        title: true,
        authors: true,
        journal: true,
        publishedAt: true,
        hash: true,
        chainTxHash: true,
        metadata: true,
        createdAt: true,
      },
    });

    // Filter by tag if provided
    if (tag) {
      evidence = evidence.filter((e) => {
        const metadata = e.metadata as any;
        const tags = metadata?.tags || [];
        return Array.isArray(tags) && tags.includes(tag);
      });
    }

    res.json({
      count: evidence.length,
      evidence,
    });
  } catch (error) {
    console.error('Error fetching evidence:', error);
    res.status(500).json({
      error: 'Failed to fetch evidence',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

evidenceRouter.get('/registry/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const evidence = await prisma.evidence.findUnique({
      where: { id },
    });

    if (!evidence) {
      return res.status(404).json({
        error: 'not_found',
        error_description: 'Evidence not found',
      });
    }

    res.json(evidence);
  } catch (error) {
    console.error('Error fetching evidence:', error);
    res.status(500).json({
      error: 'Failed to fetch evidence',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

evidenceRouter.get('/registry/doi/:doi', async (req, res) => {
  try {
    const { doi } = req.params;
    // Decode DOI if URL-encoded
    const decodedDoi = decodeURIComponent(doi);
    const evidence = await prisma.evidence.findUnique({
      where: { doi: decodedDoi },
    });

    if (!evidence) {
      return res.status(404).json({
        error: 'not_found',
        error_description: 'Evidence not found',
      });
    }

    res.json(evidence);
  } catch (error) {
    console.error('Error fetching evidence:', error);
    res.status(500).json({
      error: 'Failed to fetch evidence',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/evidence/registry - Create new evidence entry and anchor hash
 */
evidenceRouter.post('/registry', async (req, res) => {
  try {
    const { doi, title, abstract, authors, journal, publishedAt, metadata } = req.body;

    if (!doi || !title || !abstract) {
      return res.status(400).json({
        error: 'validation_error',
        error_description: 'doi, title, and abstract are required',
      });
    }

    // Calculate SHA-256 hash
    const hashInput = `${doi}${abstract}`;
    const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

    // Anchor hash on-chain
    const polkadotService = new PolkadotService();
    const payload = JSON.stringify({
      id: doi,
      hash,
      type: 'evidence',
      timestamp: new Date().toISOString(),
    });

    let chainTxHash: string | null = null;
    try {
      chainTxHash = await polkadotService.anchorData(payload);
    } catch (error) {
      console.warn('Failed to anchor on-chain (using mock):', error);
      chainTxHash = `mock-tx-${Date.now()}`;
    }

    // Create evidence record
    const evidence = await prisma.evidence.create({
      data: {
        doi,
        title,
        abstract,
        authors: authors || [],
        journal: journal || null,
        publishedAt: publishedAt ? new Date(publishedAt) : null,
        hash,
        chainTxHash,
        metadata: metadata || null,
      },
    });

    res.status(201).json(evidence);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'duplicate',
        error_description: 'Evidence with this DOI already exists',
      });
    }
    console.error('Error creating evidence:', error);
    res.status(500).json({
      error: 'Failed to create evidence',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

