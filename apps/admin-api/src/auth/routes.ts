/**
 * WebAuthn Authentication Routes
 *
 * Handles WebAuthn registration and authentication endpoints
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  generateRegistrationOptionsForUser,
  verifyRegistrationResponseForUser,
  generateAuthenticationOptionsForUser,
  verifyAuthenticationResponseForUser,
} from './webauthn-service';
import {
  generateRecoveryKey,
  verifyRecoveryKey,
  listRecoveryKeys,
  revokeRecoveryKey,
  renameRecoveryKey,
} from './recovery-keys';
import { AuthenticatedRequest } from './middleware/types';

const router: Router = Router();
const prisma = new PrismaClient();

type WebAuthnAuthenticatorRecord = {
  id: string;
  userId: string;
  name: string | null;
  deviceBound: boolean;
  transports: string[] | null;
  createdAt: Date;
  lastUsedAt: Date | null;
};

/**
 * POST /api/auth/webauthn/register/start
 * Start WebAuthn registration
 */
router.post('/webauthn/register/start', async (req: Request, res: Response) => {
  try {
    const { userId, requireDeviceBound } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const challenge = await generateRegistrationOptionsForUser(
      {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      requireDeviceBound === true
    );

    res.json(challenge);
  } catch (error: any) {
    console.error('Registration start error:', error);
    res.status(500).json({ error: error.message || 'Registration failed' });
  }
});

/**
 * POST /api/auth/webauthn/register/finish
 * Complete WebAuthn registration
 */
router.post('/webauthn/register/finish', async (req: Request, res: Response) => {
  try {
    const { userId, response, challengeId, name } = req.body;

    if (!userId || !response || !challengeId || !name) {
      return res.status(400).json({
        error: 'userId, response, challengeId, and name required',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await verifyRegistrationResponseForUser(
      {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      response,
      challengeId,
      name
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      authenticatorId: result.authenticatorId,
    });
  } catch (error: any) {
    console.error('Registration finish error:', error);
    res.status(500).json({ error: error.message || 'Registration failed' });
  }
});

/**
 * POST /api/auth/webauthn/authenticate/start
 * Start WebAuthn authentication
 */
router.post(
  '/webauthn/authenticate/start',
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'userId required' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const challenge = await generateAuthenticationOptionsForUser({
        id: user.id,
        email: user.email,
        name: user.name,
      });

      res.json(challenge);
    } catch (error: any) {
      console.error('Authentication start error:', error);
      res.status(500).json({
        error: error.message || 'Authentication failed',
      });
    }
  }
);

/**
 * POST /api/auth/webauthn/authenticate/finish
 * Complete WebAuthn authentication
 */
router.post(
  '/webauthn/authenticate/finish',
  async (req: Request, res: Response) => {
    try {
      const { userId, response, challengeId } = req.body;

      if (!userId || !response || !challengeId) {
        return res.status(400).json({
          error: 'userId, response, and challengeId required',
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const result = await verifyAuthenticationResponseForUser(
        {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        response,
        challengeId
      );

      if (!result.success) {
        return res.status(401).json({ error: result.error });
      }

      // B121C-AAL-024: Capture AAL factor type and strength for audit
      const authenticator = await prisma.webAuthnAuthenticator.findUnique({
        where: { id: result.authenticatorId },
      });

      // Determine AAL level and factor type
      let aalLevel: 1 | 2 | 3 = 1;
      let factorType: string = 'unknown';
      let factorStrength: string = 'unknown';

      if (authenticator) {
        if (authenticator.deviceBound) {
          aalLevel = 3;
          factorType = 'device-bound';
          factorStrength = 'hardware-bound';
        } else {
          aalLevel = 2;
          factorType = 'phishing-resistant';
          factorStrength = 'cryptographic';
        }
      }

      // B121C-AAL-024: Audit login with factor type and strength
      await prisma.auditEvent.create({
        data: {
          type: 'ADMIN_LOGIN',
          userId: user.id,
          data: {
            aalLevel,
            factorType,
            factorStrength,
            authenticatorId: result.authenticatorId,
            authenticatorName: authenticator?.name,
            deviceBound: authenticator?.deviceBound || false,
            timestamp: new Date().toISOString(),
            ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown',
          },
        },
      });

      // In production, issue a session token or JWT here
      res.json({
        success: true,
        authenticatorId: result.authenticatorId,
        aalLevel,
        factorType,
        factorStrength,
        // TODO: Include session token
      });
    } catch (error: any) {
      console.error('Authentication finish error:', error);
      res.status(500).json({
        error: error.message || 'Authentication failed',
      });
    }
  }
);

/**
 * GET /api/auth/webauthn/authenticators
 * List user's WebAuthn authenticators
 */
router.get('/webauthn/authenticators', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const authenticators = (await prisma.webAuthnAuthenticator.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    })) as WebAuthnAuthenticatorRecord[];

    res.json({
      authenticators: authenticators.map((auth) => ({
        id: auth.id,
        name: auth.name,
        deviceBound: auth.deviceBound,
        transports: auth.transports || [],
        createdAt: auth.createdAt,
        lastUsedAt: auth.lastUsedAt,
      })),
    });
  } catch (error: any) {
    console.error('List authenticators error:', error);
    res.status(500).json({ error: error.message || 'Failed to list authenticators' });
  }
});

/**
 * DELETE /api/auth/webauthn/authenticators/:id
 * Revoke a WebAuthn authenticator
 */
router.delete(
  '/webauthn/authenticators/:id',
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({ error: 'userId required' });
      }

      const authenticator = await prisma.webAuthnAuthenticator.findUnique({
        where: { id },
      });

      if (!authenticator || authenticator.userId !== userId) {
        return res.status(404).json({ error: 'Authenticator not found' });
      }

      await prisma.webAuthnAuthenticator.update({
        where: { id },
        data: { revokedAt: new Date() },
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Revoke authenticator error:', error);
      res.status(500).json({ error: error.message || 'Failed to revoke authenticator' });
    }
  }
);

/**
 * PATCH /api/auth/webauthn/authenticators/:id/rename
 * Rename a WebAuthn authenticator
 */
router.patch(
  '/webauthn/authenticators/:id/rename',
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { userId, name } = req.body;

      if (!userId || !name) {
        return res.status(400).json({ error: 'userId and name required' });
      }

      const authenticator = await prisma.webAuthnAuthenticator.findUnique({
        where: { id },
      });

      if (!authenticator || authenticator.userId !== userId) {
        return res.status(404).json({ error: 'Authenticator not found' });
      }

      await prisma.webAuthnAuthenticator.update({
        where: { id },
        data: { name },
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Rename authenticator error:', error);
      res.status(500).json({ error: error.message || 'Failed to rename authenticator' });
    }
  }
);

/**
 * POST /api/auth/recovery-keys/generate
 * Generate a new recovery key
 */
router.post('/recovery-keys/generate', async (req: Request, res: Response) => {
  try {
    const { userId, name } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { key, id } = await generateRecoveryKey(userId, name);

    // Return the plaintext key (show to user once)
    res.json({
      success: true,
      recoveryKeyId: id,
      key, // Plaintext key - show to user once, then discard
      warning: 'Save this key securely. It will not be shown again.',
    });
  } catch (error: any) {
    console.error('Generate recovery key error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate recovery key' });
  }
});

/**
 * POST /api/auth/recovery-keys/verify
 * Verify a recovery key
 */
router.post('/recovery-keys/verify', async (req: Request, res: Response) => {
  try {
    const { userId, key } = req.body;

    if (!userId || !key) {
      return res.status(400).json({ error: 'userId and key required' });
    }

    const result = await verifyRecoveryKey(userId, key);

    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    // B121C-AAL-024: Audit recovery key login with factor type and strength
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (user) {
      await prisma.auditEvent.create({
        data: {
          type: 'ADMIN_LOGIN',
          userId: user.id,
          data: {
            aalLevel: 2, // Recovery keys are AAL2
            factorType: 'recovery-key',
            factorStrength: 'cryptographic',
            recoveryKeyId: result.recoveryKeyId,
            timestamp: new Date().toISOString(),
            ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown',
          },
        },
      });
    }

    // In production, issue a session token here
    res.json({
      success: true,
      recoveryKeyId: result.recoveryKeyId,
      aalLevel: 2,
      factorType: 'recovery-key',
      factorStrength: 'cryptographic',
      // TODO: Include session token
    });
  } catch (error: any) {
    console.error('Verify recovery key error:', error);
    res.status(500).json({ error: error.message || 'Failed to verify recovery key' });
  }
});

/**
 * GET /api/auth/recovery-keys
 * List user's recovery keys
 */
router.get('/recovery-keys', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const recoveryKeys = await listRecoveryKeys(userId);

    res.json({ recoveryKeys });
  } catch (error: any) {
    console.error('List recovery keys error:', error);
    res.status(500).json({ error: error.message || 'Failed to list recovery keys' });
  }
});

/**
 * DELETE /api/auth/recovery-keys/:id
 * Revoke a recovery key
 */
router.delete('/recovery-keys/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const result = await revokeRecoveryKey(userId as string, id);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Revoke recovery key error:', error);
    res.status(500).json({ error: error.message || 'Failed to revoke recovery key' });
  }
});

/**
 * PATCH /api/auth/recovery-keys/:id/rename
 * Rename a recovery key
 */
router.patch('/recovery-keys/:id/rename', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId, name } = req.body;

    if (!userId || !name) {
      return res.status(400).json({ error: 'userId and name required' });
    }

    const result = await renameRecoveryKey(userId, id, name);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Rename recovery key error:', error);
    res.status(500).json({ error: error.message || 'Failed to rename recovery key' });
  }
});

export { router as authRouter };
