import { NextFunction, Request, Response } from 'express';
import { prisma } from '../prisma/client.js';

/**
 * Extended request with authenticated user context.
 */
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
    did?: string;
    claimLevel: number;
  };
}

/**
 * Load user session from header or JWT token.
 * In production, validate JWT and extract userId.
 */
export async function loadUserSession(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthRequest;

  // In production, extract from JWT: const token = req.headers.authorization?.split(' ')[1];
  const userId = req.headers['x-user-id'] as string;

  if (!userId) {
    // Public endpoint - continue without user
    return next();
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        npiClaims: {
          orderBy: { level: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    authReq.user = {
      id: user.id,
      email: user.email,
      roles: user.roles,
      did: user.did || undefined,
      claimLevel: user.npiClaims[0]?.level || 0,
    };

    next();
  } catch (error) {
    console.error('Load user session error:', error);
    res.status(500).json({ error: 'Failed to load session' });
  }
}

/**
 * Require user authentication.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthRequest;

  if (!authReq.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  next();
}

/**
 * Require specific role(s).
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;

    if (!authReq.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasRole = roles.some((role) => authReq.user!.roles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: authReq.user.roles,
      });
    }

    next();
  };
}

/**
 * Require minimum claim level.
 */
export function requireLevel(minLevel: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;

    if (!authReq.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (authReq.user.claimLevel < minLevel) {
      return res.status(403).json({
        error: 'Insufficient claim level',
        required: minLevel,
        current: authReq.user.claimLevel,
      });
    }

    next();
  };
}

/**
 * Require issuer access (issuer role + Level 3).
 */
export function requireIssuer(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthRequest;

  if (!authReq.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const hasIssuerRole = authReq.user.roles.includes('issuer');
  const hasLevel3 = authReq.user.claimLevel >= 3;

  if (!hasIssuerRole || !hasLevel3) {
    return res.status(403).json({
      error: 'Issuer access required',
      details: 'Must have issuer role and Level 3 claim',
      currentLevel: authReq.user.claimLevel,
      currentRoles: authReq.user.roles,
    });
  }

  next();
}

/**
 * Require verifier access.
 */
export function requireVerifier(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthRequest;

  if (!authReq.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const hasVerifierRole = authReq.user.roles.includes('verifier');

  if (!hasVerifierRole) {
    return res.status(403).json({
      error: 'Verifier access required',
      currentRoles: authReq.user.roles,
    });
  }

  next();
}
