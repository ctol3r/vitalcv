/**
 * healthstart.ts (route) — Substrate Consolidation: Phase 3
 *
 * GET /api/healthstart/profiles          — List all deployment profiles
 * GET /api/healthstart/profiles/:type    — Get a specific profile
 * GET /api/healthstart/evidence          — Evidence pack (default: SaaS)
 * GET /api/healthstart/evidence/:type    — Evidence pack for a profile type
 */

import type { Express, Request, Response } from 'express';
import {
  listDeploymentProfiles,
  getDeploymentProfile,
  generateEvidencePack,
  type DeploymentProfileType,
} from '../services/healthstart/deploymentProfile';
import {
  getInheritedControls,
  validateControlHealth,
} from '../services/healthstart/controlInheritance';
import { generateSSPPack } from '../services/healthstart/sspPack';
import { log } from '../obs/logger';

const VALID_PROFILE_TYPES: DeploymentProfileType[] = ['SaaS', 'PrivateVPC', 'GovEnclave'];

function isValidProfileType(v: unknown): v is DeploymentProfileType {
  return VALID_PROFILE_TYPES.includes(v as DeploymentProfileType);
}

export function registerHealthStartRoutes(app: Express): void {
  /**
   * GET /api/healthstart/profiles
   * Returns all available deployment profiles (metadata only, no evidence).
   */
  app.get('/api/healthstart/profiles', (_req: Request, res: Response) => {
    res.json({ profiles: listDeploymentProfiles() });
  });

  /**
   * GET /api/healthstart/profiles/:type
   * Returns a single deployment profile. Type: SaaS | PrivateVPC | GovEnclave
   */
  app.get('/api/healthstart/profiles/:type', (req: Request, res: Response) => {
    const { type } = req.params;
    if (!isValidProfileType(type)) {
      res.status(400).json({
        error: `Invalid profile type "${type}". Valid: ${VALID_PROFILE_TYPES.join(', ')}`,
      });
      return;
    }
    res.json(getDeploymentProfile(type));
  });

  /**
   * GET /api/healthstart/evidence
   * Returns a full compliance evidence pack for the default SaaS profile.
   */
  app.get('/api/healthstart/evidence', async (_req: Request, res: Response) => {
    try {
      const pack = await generateEvidencePack('SaaS');
      res.json(pack);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'healthstart: evidence generation failed', { error: message });
      res.status(500).json({ error: 'Failed to generate compliance evidence pack' });
    }
  });

  /**
   * GET /api/healthstart/evidence/:type
   * Returns a compliance evidence pack for a specific deployment profile.
   */
  app.get('/api/healthstart/evidence/:type', async (req: Request, res: Response) => {
    const { type } = req.params;
    if (!isValidProfileType(type)) {
      res.status(400).json({
        error: `Invalid profile type "${type}". Valid: ${VALID_PROFILE_TYPES.join(', ')}`,
      });
      return;
    }
    try {
      const pack = await generateEvidencePack(type);
      res.json(pack);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'healthstart: evidence generation failed', { type, error: message });
      res.status(500).json({ error: 'Failed to generate compliance evidence pack' });
    }
  });

  /**
   * GET /api/healthstart/controls
   * Returns inherited controls for a deployment profile (default: SaaS).
   * Query: ?profile=SaaS|PrivateVPC|GovEnclave
   */
  app.get('/api/healthstart/controls', (req: Request, res: Response) => {
    const profileType = (req.query.profile as string) || 'SaaS';
    if (!isValidProfileType(profileType)) {
      res.status(400).json({
        error: `Invalid profile type "${profileType}". Valid: ${VALID_PROFILE_TYPES.join(', ')}`,
      });
      return;
    }
    res.json(getInheritedControls(profileType));
  });

  /**
   * GET /api/healthstart/controls/health
   * Validates that all automated controls are operational.
   */
  app.get('/api/healthstart/controls/health', (_req: Request, res: Response) => {
    const health = validateControlHealth();
    res.json(health);
  });

  /**
   * GET /api/healthstart/ssp
   * Generates a full SSP evidence pack (default: SaaS).
   * Query: ?profile=SaaS|PrivateVPC|GovEnclave
   */
  app.get('/api/healthstart/ssp', async (req: Request, res: Response) => {
    const profileType = (req.query.profile as string) || 'SaaS';
    if (!isValidProfileType(profileType)) {
      res.status(400).json({
        error: `Invalid profile type "${profileType}". Valid: ${VALID_PROFILE_TYPES.join(', ')}`,
      });
      return;
    }
    try {
      const pack = await generateSSPPack(profileType);
      res.json(pack);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'healthstart: SSP generation failed', { profileType, error: message });
      res.status(500).json({ error: 'Failed to generate SSP evidence pack' });
    }
  });
}
