import type { Express, Request, Response } from 'express';
import { ReadinessEvaluator } from '../services/intelligence/graphRagEvaluator';

const evaluator = new ReadinessEvaluator();

export function registerIntelligenceRoutes(app: Express): void {
  /**
   * POST /api/intelligence/evaluate-readiness
   *
   * Accepts { npi, state, specialty } and returns a deterministic
   * readiness evaluation powered by the Clinical Ontology graph.
   */
  app.post('/api/intelligence/evaluate-readiness', async (req: Request, res: Response) => {
    const { npi, state, specialty } = req.body as {
      npi?: string;
      state?: string;
      specialty?: string;
    };

    if (!npi || !state || !specialty) {
      return res.status(400).json({
        error: 'Missing required fields: npi, state, specialty',
      });
    }

    if (!/^\d{10}$/.test(npi)) {
      return res.status(400).json({ error: 'NPI must be a 10-digit number' });
    }

    try {
      const result = await evaluator.evaluateCandidate(npi, state, specialty);
      return res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
  });
}
