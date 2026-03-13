import type { Express, Request, Response } from 'express';
import { proofRateLimit } from '../middleware/rateLimitFactory';
import { log } from '../obs/logger';
import { buildTrustProofBundle, renderTrustProofPdf } from '../services/trust/trustProof';

const NPI_RE = /^\d{10}$/;

export function registerTrustProofRoutes(app: Express): void {
  app.get('/api/trust-proof/:npi', proofRateLimit, async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!npi || !NPI_RE.test(npi)) {
      return res.status(400).json({
        error: 'invalid_npi',
        error_description: 'NPI must be a 10-digit string.',
      });
    }

    try {
      const bundle = await buildTrustProofBundle(npi);
      const format = typeof req.query.format === 'string'
        ? req.query.format.trim().toLowerCase()
        : 'json';

      if (format === 'pdf') {
        const pdf = renderTrustProofPdf(bundle);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="trust-proof-${npi}.pdf"`);
        res.setHeader('Content-Length', String(pdf.length));
        return res.status(200).send(pdf);
      }

      return res.status(200).json(bundle);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to build trust proof';
      log('error', 'trust_proof_error', {
        npi,
        error: message,
      });

      if (message.includes('not found')) {
        return res.status(404).json({ error: message });
      }

      return res.status(500).json({ error: message });
    }
  });
}
