import express, { Request, Response } from 'express';
import { globalProviderAdapter } from '../services/international/providerAdapter';
import { validateRequest } from '../middleware/validateRequest';
import { param } from 'express-validator';

export const intlRouter = express.Router();

/**
 * GET /api/intl/us/:npi
 * Verify US provider by NPI
 */
intlRouter.get(
  '/us/:npi',
  param('npi').isString().notEmpty(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { npi } = req.params;
      const provider = await globalProviderAdapter.getProvider('US', npi);

      if (!provider) {
        return res.status(404).json({ error: 'Provider not found' });
      }

      return res.json(provider);
    } catch (error: any) {
      console.error('Error verifying US provider:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/intl/canada/:license
 * Verify Canadian provider by CPSO license
 */
intlRouter.get(
  '/canada/:license',
  param('license').isString().notEmpty(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { license } = req.params;
      const provider = await globalProviderAdapter.getProvider('CA', license);

      if (!provider) {
        return res.status(404).json({ error: 'Provider not found' });
      }

      return res.json(provider);
    } catch (error: any) {
      console.error('Error verifying Canadian provider:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/intl/india/:registration
 * Verify Indian provider by NMC registration
 */
intlRouter.get(
  '/india/:registration',
  param('registration').isString().notEmpty(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { registration } = req.params;
      const provider = await globalProviderAdapter.getProvider('IN', registration);

      if (!provider) {
        return res.status(404).json({ error: 'Provider not found' });
      }

      return res.json(provider);
    } catch (error: any) {
      console.error('Error verifying Indian provider:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/intl/australia/:providerId
 * Verify Australian provider by AHPRA ID
 */
intlRouter.get(
  '/australia/:providerId',
  param('providerId').isString().notEmpty(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { providerId } = req.params;
      const provider = await globalProviderAdapter.getProvider('AU', providerId);

      if (!provider) {
        return res.status(404).json({ error: 'Provider not found' });
      }

      return res.json(provider);
    } catch (error: any) {
      console.error('Error verifying Australian provider:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

