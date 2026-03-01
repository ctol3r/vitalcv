import type { Express, Request, Response } from 'express';
import { generateTrustGraph } from '../services/graph/trustGraph';

export function registerGraphRoutes(app: Express): void {
  app.get('/api/graph/:npi', (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!npi) {
      res.status(400).json({ error: 'NPI parameter is required' });
      return;
    }

    generateTrustGraph(npi)
      .then((data) => {
        res.json(data);
      })
      .catch((err) => {
        console.error('Failed to generate graph:', err);
        res.status(500).json({ error: 'Failed to generate trust graph' });
      });
  });
}
