/**
 * passport.ts — Wave 88: Clinician Passport API
 *
 * GET /api/passport/:npi — Public trust identity data.
 */

import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { generateShareLink } from '../services/passport/shareLink';
import { log } from '../obs/logger';

export function registerPassportRoutes(app: Express): void {
  app.get('/api/passport/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!npi) {
      res.status(400).json({ error: 'NPI parameter is required' });
      return;
    }

    try {
      const [artifacts, provider] = await Promise.all([
        prisma.verificationArtifact.findMany({
          where: { npi },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, source: true, status: true, trustState: true,
            checksum: true, merkleRoot: true, verifiedAt: true, createdAt: true,
          },
        }),
        prisma.provider.findFirst({ where: { npi } }),
      ]);

      const activeCount = artifacts.filter((a) => a.status === 'Valid' || a.trustState === 'verified').length;
      const totalCount = artifacts.length;
      const score = totalCount > 0 ? Math.min(activeCount / totalCount, 1.0) : 0;
      const band = score >= 0.8 ? 'GREEN' : score >= 0.5 ? 'YELLOW' : 'RED';

      const shareLink = generateShareLink(npi);

      res.json({
        clinician: {
          npi,
          name: provider?.fullName ?? `Clinician ${npi}`,
          specialty: provider?.taxonomyCode ?? 'General',
          providerType: provider?.providerType ?? 'Unknown',
        },
        credentials: artifacts.map((a) => ({
          id: a.id,
          source: a.source,
          status: a.status,
          trustState: a.trustState,
          verifiedAt: a.verifiedAt?.toISOString() ?? null,
        })),
        artifacts: artifacts.map((a) => ({
          id: a.id,
          issuer: a.source,
          hash: a.merkleRoot ?? a.checksum,
          timestamp: a.createdAt.toISOString(),
        })),
        readiness: { score: Math.round(score * 100), band, activeCount, totalCount },
        shareLink,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'passport: failed', { npi, error: message });
      res.status(500).json({ error: 'Failed to generate passport' });
    }
  });
}
