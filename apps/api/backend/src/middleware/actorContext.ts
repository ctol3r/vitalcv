import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export type ActorRole = 'clinician' | 'issuer' | 'verifier';

export interface ActorContext {
  role: ActorRole;
  orgId?: number;
  email?: string;
  userId?: number;
  inviteId?: number;
  tokenSource?: 'bearer' | 'header' | 'fallback';
}

export type RequestWithActor = Request & { actor?: ActorContext };

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret';

function parseActorRole(value: any): ActorRole | undefined {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'issuer' || normalized === 'verifier' || normalized === 'clinician')
    return normalized;
  return undefined;
}

function actorFromBearer(token: string): ActorContext | undefined {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as Record<string, any>;
    const role = parseActorRole(decoded.role || decoded.actorRole);
    if (!role) return undefined;
    return {
      role,
      orgId: decoded.orgId ? Number(decoded.orgId) : undefined,
      email: decoded.email ? String(decoded.email) : undefined,
      userId: decoded.userId ? Number(decoded.userId) : undefined,
      inviteId: decoded.inviteId ? Number(decoded.inviteId) : undefined,
      tokenSource: 'bearer',
    };
  } catch {
    return undefined;
  }
}

export function actorContextMiddleware(req: RequestWithActor, _res: Response, next: NextFunction) {
  if (req.actor) return next();

  const authHeader = req.header('authorization') || req.header('Authorization');
  const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) {
    const actor = actorFromBearer(bearer);
    if (actor) {
      req.actor = actor;
      return next();
    }
  }

  const headerRole = parseActorRole(req.header('x-actor-role'));
  if (headerRole) {
    const orgId = Number(req.header('x-actor-orgid'));
    req.actor = {
      role: headerRole,
      orgId: Number.isFinite(orgId) ? orgId : undefined,
      email: req.header('x-actor-email') || undefined,
      tokenSource: 'header',
    };
    return next();
  }

  const fallbackRole = parseActorRole(process.env.DEMO_DEFAULT_ROLE);
  if (fallbackRole) {
    req.actor = { role: fallbackRole, tokenSource: 'fallback' };
  }

  return next();
}

export function requireActorRole(
  req: RequestWithActor,
  res: Response,
  allowedRoles: ActorRole[],
): req is RequestWithActor & { actor: ActorContext } {
  if (!req.actor || !allowedRoles.includes(req.actor.role)) {
    res.status(403).json({
      error: 'Forbidden: role not authorized',
      allowedRoles,
    });
    return false;
  }
  return true;
}
