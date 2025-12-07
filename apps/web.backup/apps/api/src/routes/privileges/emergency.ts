import { Router, type Request, type Response } from 'express';
import type { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import {
  evaluateEmergencyPrivilegeEligibility,
  type EmergencyPrivilegeReason,
} from '../../services/privileges/emergency-rules';
import { anchorEvent } from '../../services/audit/anchor';

const prisma = new PrismaClient();
const router = Router();

const ALLOWED_REASONS: EmergencyPrivilegeReason[] = ['disaster', 'surge', 'shortage'];

router.get('/privileges/emergency', async (req: Request, res: Response) => {
  try {
    const orgId = typeof req.query.orgId === 'string' ? req.query.orgId : undefined;
    const clinicianId =
      typeof req.query.clinicianId === 'string' ? req.query.clinicianId : undefined;
    const includeExpired =
      typeof req.query.includeExpired === 'string'
        ? req.query.includeExpired === 'true'
        : false;

    const privileges = await prisma.emergencyPrivilege.findMany({
      where: {
        ...(orgId ? { orgId } : {}),
        ...(clinicianId ? { clinicianId } : {}),
        ...(includeExpired
          ? {}
          : {
              expiresAt: { gt: new Date() },
              revokedAt: null,
            }),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return res.json({
      privileges,
    });
  } catch (error) {
    console.error('[privileges][emergency] list failed', error);
    return res.status(500).json({ error: 'emergency_privileges_fetch_failed' });
  }
});

router.post('/privileges/emergency/issue', async (req: Request, res: Response) => {
  try {
    const clinicianId = sanitizeString(req.body?.clinicianId);
    const orgId = sanitizeString(req.body?.orgId);
    const reason = sanitizeReason(req.body?.reason);
    const expiresAt = coerceExpiry(req.body?.expiresAt);
    const issuer = sanitizeString(req.body?.issuedBy) ?? 'api';
    const metadata = buildMetadata(req.body?.metadata, { issuer });

    if (!clinicianId || !orgId) {
      return res
        .status(400)
        .json({ error: 'validation_error', message: 'clinicianId and orgId are required.' });
    }
    if (!reason) {
      return res.status(400).json({
        error: 'invalid_reason',
        message: `Reason must be one of ${ALLOWED_REASONS.join(', ')}`,
      });
    }

    const eligibility = await evaluateEmergencyPrivilegeEligibility(clinicianId, { prisma });
    if (!eligibility.eligible) {
      return res.status(409).json({
        error: 'eligibility_failed',
        eligibility,
      });
    }

    const activeExisting = await prisma.emergencyPrivilege.findFirst({
      where: {
        clinicianId,
        orgId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (activeExisting) {
      return res.status(409).json({
        error: 'duplicate_active_privilege',
        privilegeId: activeExisting.id,
      });
    }

    const privilege = await prisma.emergencyPrivilege.create({
      data: {
        clinicianId,
        orgId,
        reason,
        expiresAt,
        metadata,
      },
    });

    const anchor = anchorEvent('privilegeEmergencyIssued', {
      clinicianId,
      privilegeId: privilege.id,
      orgId,
      reason,
      expiresAt: privilege.expiresAt.toISOString(),
    });

    return res.status(201).json({
      privilege,
      eligibility,
      anchor,
    });
  } catch (error) {
    console.error('[privileges][emergency] issue failed', error);
    return res.status(500).json({ error: 'emergency_privilege_issue_failed' });
  }
});

router.post('/privileges/emergency/:privilegeId/revoke', async (req: Request, res: Response) => {
  try {
    const privilegeId = req.params.privilegeId;
    const actor = sanitizeString(req.body?.revokedBy) ?? 'api';
    const rationale = sanitizeString(req.body?.reason) ?? 'manual_revocation';

    const privilege = await prisma.emergencyPrivilege.findUnique({
      where: { id: privilegeId },
    });
    if (!privilege) {
      return res.status(404).json({ error: 'privilege_not_found' });
    }
    if (privilege.revokedAt) {
      return res.status(409).json({ error: 'already_revoked', privilege });
    }

    const revoked = await prisma.emergencyPrivilege.update({
      where: { id: privilegeId },
      data: {
        revokedAt: new Date(),
        metadata: buildMetadata(privilege.metadata, {
          revokedBy: actor,
          revocationReason: rationale,
        }),
      },
    });

    const anchor = anchorEvent('privilegeEmergencyRevoked', {
      privilegeId: revoked.id,
      clinicianId: revoked.clinicianId,
      orgId: revoked.orgId,
      reason: rationale,
      revokedAt: revoked.revokedAt?.toISOString() ?? new Date().toISOString(),
    });

    return res.json({ privilege: revoked, anchor });
  } catch (error) {
    console.error('[privileges][emergency] revoke failed', error);
    return res.status(500).json({ error: 'emergency_privilege_revoke_failed' });
  }
});

function sanitizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function sanitizeReason(value: unknown): EmergencyPrivilegeReason | null {
  const normalized = sanitizeString(value)?.toLowerCase() as EmergencyPrivilegeReason | null;
  if (!normalized) return null;
  if (!ALLOWED_REASONS.includes(normalized)) {
    return null;
  }
  return normalized;
}

function coerceExpiry(value: unknown): Date {
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  const fallbackDays = Number(process.env.EMERGENCY_PRIVILEGE_DEFAULT_DAYS ?? 30);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (Number.isFinite(fallbackDays) ? fallbackDays : 30));
  return expiresAt;
}

function buildMetadata(
  existing: Prisma.JsonValue | null | undefined,
  overlay: Record<string, unknown>,
): Prisma.JsonValue {
  const base = typeof existing === 'object' && existing !== null ? existing : {};
  return {
    ...base,
    ...overlay,
  };
}

export default router;











