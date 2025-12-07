import { PrismaClient } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';

const prisma = new PrismaClient();

/**
 * Extended Request type with user session information.
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string | number; // Supports both string (CUID) and number IDs
    email: string;
    roles: string[];
    claimLevel: number;
    did?: string;
  };
}

/**
 * Middleware to load user session and claim level.
 * In production, this would validate JWT tokens or session cookies.
 */
export async function loadUserSession(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;

    // In production, extract userId from JWT or session
    // For now, expect userId in header or body
    const userId = req.headers['x-user-id'] || req.body.userId;

    if (!userId) {
      // Public endpoint - continue without user
      return next();
    }

    // Load user with their highest claim level
    // Handle both string (CUID) and numeric IDs
    const userIdValue = isNaN(Number(userId)) ? userId : parseInt(userId as string);
    const user = await prisma.user.findUnique({
      where: { id: userIdValue as any },
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
      claimLevel: user.npiClaims[0]?.level || 0,
      did: user.did || undefined,
    };

    next();
  } catch (error: any) {
    console.error('Load user session error:', error);
    return res.status(500).json({ error: 'Failed to load user session' });
  }
}

/**
 * Require user to be authenticated.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  next();
}

/**
 * Require user to have specific role(s).
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;

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
 * Require user to have minimum claim level.
 */
export function requireClaimLevel(minLevel: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;

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
 * Require issuer role with Level 3 claim (organizational NPI).
 */
export function requireIssuerAccess(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const hasIssuerRole = authReq.user.roles.includes('issuer');
  const hasLevel3 = authReq.user.claimLevel >= 3;

  if (!hasIssuerRole || !hasLevel3) {
    return res.status(403).json({
      error: 'Issuer access required',
      details: 'Must have issuer role and Level 3 claim (organizational NPI)',
      currentRoles: authReq.user.roles,
      currentLevel: authReq.user.claimLevel,
    });
  }

  next();
}

/**
 * Require verifier role.
 */
export function requireVerifierAccess(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const hasVerifierRole = authReq.user.roles.includes('verifier');

  if (!hasVerifierRole) {
    return res.status(403).json({
      error: 'Verifier access required',
      details: 'Must have verifier role (organizational NPI or signed verifier VC)',
      currentRoles: authReq.user.roles,
    });
  }

  next();
}
