/**
 * B227A-DEV-001: Developer Portal REST Routes
 *
 * REST endpoints for developer registration, API key management, and module uploads
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { DeveloperPortalService } from '../../../services/developer/portalService';
import { ModuleUploadHandler } from '../../../services/developer/moduleUploadHandler';
import { verifyApiKey } from '../../../services/developer/models/DeveloperApiKeys';

const router = Router();
const prisma = new PrismaClient();
const portalService = new DeveloperPortalService(prisma);
const uploadHandler = new ModuleUploadHandler(prisma);

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

/**
 * Middleware to authenticate API key
 */
async function authenticateApiKey(req: Request, res: Response, next: Function) {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  const developerId = await verifyApiKey(prisma, apiKey);
  if (!developerId) {
    return res.status(401).json({ error: 'Invalid or revoked API key' });
  }

  (req as any).developerId = developerId;
  next();
}

/**
 * POST /api/developer/register
 * Register a new developer
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { vendorId, did, name, contactInfo } = req.body;

    if (!vendorId || !name) {
      return res.status(400).json({ error: 'vendorId and name are required' });
    }

    const result = await portalService.registerDeveloper({
      vendorId,
      did,
      name,
      contactInfo,
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/developer/profile
 * Get developer profile (requires API key)
 */
router.get('/profile', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const developerId = (req as any).developerId;
    const profile = await portalService.getDeveloperProfile(developerId);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/developer/profile
 * Update developer profile (requires API key)
 */
router.put('/profile', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const developerId = (req as any).developerId;
    const { name, did, contactInfo } = req.body;

    const updated = await portalService.updateDeveloperProfile(developerId, {
      name,
      did,
      contactInfo,
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/developer/api-keys
 * Generate a new API key (requires API key)
 */
router.post('/api-keys', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const developerId = (req as any).developerId;
    const result = await portalService.generateApiKey(developerId);

    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/developer/api-keys
 * List API keys (requires API key)
 */
router.get('/api-keys', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const developerId = (req as any).developerId;
    const keys = await portalService.listApiKeys(developerId);

    res.json(keys);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/developer/api-keys/:id
 * Revoke an API key (requires API key)
 */
router.delete('/api-keys/:id', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await portalService.revokeApiKey(id);

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/developer/modules/upload
 * Upload a module package (requires API key)
 */
router.post(
  '/modules/upload',
  authenticateApiKey,
  upload.single('package'),
  async (req: Request, res: Response) => {
    try {
      const developerId = (req as any).developerId;
      const { name, version, description, capabilities, signature, signatureAlgorithm } = req.body;

      if (!name || !version) {
        return res.status(400).json({ error: 'name and version are required' });
      }

      const metadata = {
        vendorId: developerId,
        name,
        version,
        description: description || '',
        capabilities: capabilities ? JSON.parse(capabilities) : [],
        signature,
        signatureAlgorithm,
      };

      const result = await uploadHandler.handleUpload(req, metadata);

      if (result.error) {
        return res.status(400).json({ error: result.error, details: result });
      }

      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * POST /api/developer/modules
 * Submit a module for approval (requires API key)
 */
router.post('/modules', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const developerId = (req as any).developerId;
    const { name, version, description, capabilities, price, currency, licenseType } = req.body;

    if (!name || !version || !description) {
      return res.status(400).json({ error: 'name, version, and description are required' });
    }

    const result = await portalService.submitModule({
      name,
      version,
      description,
      vendorId: developerId,
      capabilities: capabilities || [],
      price: price || 0,
      currency: currency || 'USD',
      licenseType: licenseType || 'SUBSCRIPTION',
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export { router as developerRouter };

