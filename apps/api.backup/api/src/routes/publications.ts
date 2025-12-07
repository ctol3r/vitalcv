import { Router } from 'express';

export const pubsRouter = Router();

/**
 * POST /claim
 * Claim authorship of a publication via PubMed ID
 */
pubsRouter.post('/claim', async (req, res) => {
  try {
    const userId = (req as any).user?.userId || 1; // Fallback for demo
    const { pmid, authorName } = req.body;

    if (!pmid || !authorName) {
      return res.status(400).json({
        error: 'pmid and authorName are required'
      });
    }

    // TODO: Wire to publication controller when ready
    // const out = await claimAuthorPublications(userId, pmid, authorName);

    // Stub response for now
    const out = {
      success: true,
      pmid,
      authorName,
      userId,
      message: 'Publication claim recorded (stub)',
      verified: false,
      provenanceId: `prov_${Date.now()}`
    };

    res.json(out);
  } catch (err: any) {
    console.error('Publication claim error:', err);
    res.status(500).json({ error: err.message });
  }
});

