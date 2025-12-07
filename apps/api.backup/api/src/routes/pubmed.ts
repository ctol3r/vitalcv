// src/routes/pubmed.ts — PubMed search API endpoint

import express from 'express';
import type { Request, Response } from 'express';
import { searchPubMed } from '../services/pubmed';

export const pubmedRouter = express.Router();

/**
 * GET /api/pubmed/search?q=...
 * Search PubMed for publications
 */
pubmedRouter.get('/search', async (req: Request, res: Response) => {
  try {
    const query = String(req.query.q || req.query.query || '');
    const max = parseInt(String(req.query.max || '10'), 10);

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    if (max > 100) {
      return res.status(400).json({ error: 'Max results cannot exceed 100' });
    }

    const results = await searchPubMed(query, max);

    res.json({
      query,
      count: results.length,
      results,
    });
  } catch (error: any) {
    console.error('PubMed search error:', error);
    res.status(500).json({ error: 'Failed to search PubMed', message: error.message });
  }
});

/**
 * POST /api/pubmed/claim
 * Claim a publication for a user profile
 */
pubmedRouter.post('/claim', async (req: Request, res: Response) => {
  try {
    const { pmid, userId, authorName } = req.body;

    if (!pmid || !userId) {
      return res.status(400).json({ error: 'PMID and userId are required' });
    }

    // TODO: Store publication claim in database
    // For now, return success
    res.json({
      success: true,
      pmid,
      userId,
      authorName: authorName || null,
      claimedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('PubMed claim error:', error);
    res.status(500).json({ error: 'Failed to claim publication', message: error.message });
  }
});

