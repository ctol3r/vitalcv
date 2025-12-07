import { NextFunction, Request, Response } from 'express';
import { OrgMembershipRole } from '@prisma/client';
import {
  getOrgMembership,
  listMembershipsForUser,
} from '../../../services/org/models/OrgMembership';
import { logOrgSwitchEvent } from '../../../services/audit/orgSwitchEvents';

export interface ActiveOrgRequest extends Request {
  user?: {
    id: string | number;
    [key: string]: any;
  };
  session?: Record<string, any>;
  activeOrgId?: string;
  activeOrgRole?: OrgMembershipRole;
  orgMembership?: Awaited<ReturnType<typeof getOrgMembership>>;
}

export async function requireActiveOrg(
  req: ActiveOrgRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user || typeof req.user.id === 'undefined') {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Authentication required before selecting an organization',
    });
  }

  try {
    const userId = String(req.user.id);
    const sources = resolveActiveOrgSource(req);
    let activeOrgId = sources.value;
    let membershipsCache: Awaited<ReturnType<typeof listMembershipsForUser>> | undefined;

    if (!activeOrgId) {
      membershipsCache = await listMembershipsForUser(userId);

      if (membershipsCache.length === 0) {
        return res.status(403).json({
          error: 'org_membership_required',
          message: 'No organization memberships found for this user',
        });
      }

      if (membershipsCache.length === 1) {
        activeOrgId = membershipsCache[0].orgId;
      } else {
        return res.status(400).json({
          error: 'active_org_required',
          message: 'Multiple organizations available. Specify X-Active-Org-Id to continue.',
          orgs: membershipsCache.map((m) => ({
            orgId: m.orgId,
            name: m.org?.partnerName || m.org?.partnerId || m.orgId,
            role: m.role,
          })),
        });
      }
    }

    let membership = membershipsCache?.find((m) => m.orgId === activeOrgId) || null;

    if (!membership) {
      membership = await getOrgMembership(userId, activeOrgId);
    }

    if (!membership) {
      return res.status(403).json({
        error: 'org_access_denied',
        message: 'User is not a member of the requested organization',
        orgId: activeOrgId,
      });
    }

    await maybeLogOrgSwitch(userId, sources.previous, membership.orgId);

    req.activeOrgId = membership.orgId;
    req.activeOrgRole = membership.role as OrgMembershipRole;
    req.orgMembership = membership;
    res.locals.activeOrgId = membership.orgId;

    if (req.session) {
      req.session.activeOrgId = membership.orgId;
    }

    if (typeof res.cookie === 'function') {
      res.cookie('activeOrgId', membership.orgId, {
        sameSite: 'lax',
        httpOnly: false,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    }

    next();
  } catch (error) {
    console.error('[requireActiveOrg] Failed to resolve organization', error);
    return res.status(500).json({
      error: 'active_org_resolution_failed',
      message: 'Unable to resolve active organization for this request',
    });
  }
}

function resolveActiveOrgSource(req: ActiveOrgRequest) {
  const headerValue = sanitize(req.headers['x-active-org-id']);
  const sessionValue = sanitize(req.session?.activeOrgId);
  const cookieValue = sanitize(parseCookies(req.headers?.cookie || '').activeOrgId);

  const value = headerValue || sessionValue || cookieValue;
  const previous = sessionValue || cookieValue;

  return {
    value,
    headerValue,
    sessionValue,
    cookieValue,
    previous,
  };
}

function sanitize(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseCookies(header: string) {
  return header.split(';').reduce<Record<string, string>>((acc, pair) => {
    const [key, ...rest] = pair.split('=');
    if (!key || rest.length === 0) {
      return acc;
    }
    acc[key.trim()] = decodeURIComponent(rest.join('=').trim());
    return acc;
  }, {});
}

async function maybeLogOrgSwitch(
  userId: string,
  previousOrgId: string | undefined,
  newOrgId: string
) {
  if (!previousOrgId || previousOrgId === newOrgId) {
    return;
  }

  await logOrgSwitchEvent({
    userId,
    oldOrgId: previousOrgId,
    newOrgId,
  });
}
