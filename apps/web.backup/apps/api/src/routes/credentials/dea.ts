import { Router, type Request, type Response } from 'express';
import type { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import {
  issueDeaMateStatusCredential,
  type IssueDeaMateCredentialInput,
} from '../../services/dea/credential';
import { validateMateTraining } from '../../services/dea/mate-validator';

const prisma = new PrismaClient();
const router = Router();

router.get('/credentials/dea/:clinicianId', async (req: Request, res: Response) => {
  try {
    const clinicianId = req.params.clinicianId;
    if (!clinicianId) {
      return res.status(400).json({ error: 'clinician_id_required' });
    }

    const record = await prisma.dEACredential.findFirst({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
    });

    if (!record) {
      return res.json({
        credential: null,
        summary: null,
      });
    }

    const metadata = parseMetadata(record.metadata);
    const mate = validateMateTraining({
      totalHours: record.mateHours,
      categories: metadata.mateCategories,
    });

    return res.json({
      credential: record,
      summary: {
        deaNumber: record.deaNumber,
        status: record.expiration > new Date() ? 'ACTIVE' : 'EXPIRED',
        expiration: record.expiration,
        prescriptiveAuthority: metadata.prescriptiveAuthority,
        schedules: metadata.schedules,
        mate,
        lastVerifiedAt: metadata.lastVerifiedAt,
        source: metadata.source,
      },
    });
  } catch (error) {
    console.error('[credentials][dea] fetch failed', error);
    return res.status(500).json({ error: 'dea_credential_fetch_failed' });
  }
});

router.post('/credentials/dea/refresh', async (req: Request, res: Response) => {
  try {
    const payload = mapRefreshPayload(req.body);
    if (!payload.clinicianId) {
      return res.status(400).json({ error: 'clinician_id_required' });
    }

    const result = await issueDeaMateStatusCredential(payload);
    return res.json(result);
  } catch (error) {
    console.error('[credentials][dea] refresh failed', error);
    return res.status(500).json({ error: 'dea_refresh_failed', message: extractMessage(error) });
  }
});

function mapRefreshPayload(body: any): IssueDeaMateCredentialInput {
  const clinicianId = typeof body?.clinicianId === 'string' ? body.clinicianId.trim() : '';
  const deaNumber = typeof body?.deaNumber === 'string' ? body.deaNumber.trim() : undefined;
  const mateHours =
    typeof body?.mateHours === 'number'
      ? body.mateHours
      : typeof body?.mateHours === 'string'
        ? Number(body.mateHours)
        : undefined;
  const mateCategories = Array.isArray(body?.mateCategories)
    ? body.mateCategories.filter((entry: unknown): entry is string => typeof entry === 'string')
    : undefined;

  return {
    clinicianId,
    deaNumber,
    mateHours,
    mateCategories,
  };
}

function parseMetadata(metadata: Prisma.JsonValue | null | undefined) {
  if (!metadata || typeof metadata !== 'object') {
    return {
      source: 'unknown',
      registrantName: null,
      registrantAddress: null,
      schedules: [],
      lastVerifiedAt: null,
      prescriptiveAuthority: 'Unknown',
      mateCategories: [] as string[],
    };
  }

  const value = metadata as {
    source?: string;
    registrantName?: string;
    registrantAddress?: string;
    schedules?: string[];
    lastVerifiedAt?: string;
    prescriptiveAuthority?: string;
    mateCategories?: string[];
  };

  return {
    source: value.source ?? 'unknown',
    registrantName: value.registrantName ?? null,
    registrantAddress: value.registrantAddress ?? null,
    schedules: value.schedules ?? [],
    lastVerifiedAt: value.lastVerifiedAt ?? null,
    prescriptiveAuthority: value.prescriptiveAuthority ?? 'Unknown',
    mateCategories: Array.isArray(value.mateCategories) ? value.mateCategories : [],
  };
}

function extractMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export default router;











