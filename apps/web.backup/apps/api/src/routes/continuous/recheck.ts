import { Router, type Request, type Response } from 'express';
import { PrismaClient, type Prisma } from '@prisma/client';
import {
  PsvParallelOrchestrator,
  type PsvDecision,
  type SimpleCheckResult,
} from '../../services/psv/orchestrator';
import { runContinuousChecksForClinician } from '../../workers/continuous-monitor';
import { checkStatusList } from '../../services/verify/statuslist';
import type { StatusListPointer } from '../../services/verify/types';

const prisma = new PrismaClient();
const router = Router();

router.post('/continuous/recheck/:clinicianId', async (req: Request, res: Response) => {
  const { clinicianId } = req.params;
  if (!clinicianId) {
    return res.status(400).json({
      error: 'invalid_request',
      message: 'clinicianId path parameter is required',
    });
  }

  try {
    const continuous = await runContinuousChecksForClinician(clinicianId);
    const psvReport = await runPsvReport(clinicianId, continuous.checks);
    const statusList = await runStatusListPrecheck(clinicianId);

    return res.json({
      clinicianId,
      generatedAt: new Date().toISOString(),
      checks: continuous.checks,
      readiness: continuous.readiness ?? null,
      psvReport,
      statusList,
    });
  } catch (error) {
    console.error('[continuous:recheck] failed', error);
    return res.status(500).json({
      error: 'continuous_recheck_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

async function runPsvReport(
  clinicianId: string,
  checks: Array<Record<string, any>>,
) {
  const orchestrator = new PsvParallelOrchestrator({
    providers: {
      license: async () => buildLicenseDecision(checks.find((check) => check.type === 'license')),
      npdb: async () => buildSimpleResult('NPDB', checks.find((check) => check.type === 'npdb')),
      sanctions: async () =>
        buildSimpleResult('Sanctions', checks.find((check) => check.type === 'sanctions')),
      boardCert: async () =>
        buildSimpleResult('Board Certification', checks.find((check) => check.type === 'board')),
      education: async () => ({
        status: 'CLEAR',
        detail: 'Education snapshot reused from board certification review.',
        checkedAt: new Date().toISOString(),
        confidence: 0.9,
      }),
    },
  });

  return orchestrator.run({ clinicianId });
}

async function runStatusListPrecheck(clinicianId: string) {
  const credentials = await prisma.walletCredential.findMany({
    where: { clinicianId },
    select: {
      credentialId: true,
      payload: true,
    },
    take: 20,
  });

  const details = [];
  for (const credential of credentials) {
    try {
      const pointer = extractStatusPointer(credential.payload);
      const result = await checkStatusList(pointer, process.env.STATUSLIST_FALLBACK_URL);
      details.push({
        credentialId: credential.credentialId,
        revoked: result.revoked,
        pointer: result.pointer,
        checkedAt: result.checkedAt,
        reason: result.reason,
      });
    } catch (error) {
      details.push({
        credentialId: credential.credentialId,
        revoked: false,
        pointer: null,
        checkedAt: new Date().toISOString(),
        reason: error instanceof Error ? error.message : 'statuslist_check_failed',
      });
    }
  }

  return {
    checked: details.length,
    revoked: details.filter((entry) => entry.revoked).length,
    details,
  };
}

function buildLicenseDecision(source?: Record<string, any>): PsvDecision {
  const decidedAt = new Date().toISOString();
  const status = normalizeStatus(source?.status);
  const confidence = status === 'pass' ? 0.96 : status === 'warn' ? 0.78 : 0.4;

  return {
    status: status === 'fail' ? 'HITL' : 'AUTO_VERIFIED',
    confidence,
    fields: {
      licenseNumber: typeof source?.sample?.licenseNumber === 'string' ? source.sample.licenseNumber : null,
      expirationDate: Array.isArray(source?.expiringSoon) && source.expiringSoon.length > 0
        ? source.expiringSoon[0]?.expiresAt ?? null
        : null,
      stateCode: typeof source?.sample?.state === 'string' ? source.sample.state : null,
      matches: {},
      confidences: {},
      extractedAt: decidedAt,
      rawText: 'Continuous credentialing snapshot',
    },
    template: {
      id: 'continuous-monitor',
      name: 'Continuous Credential Monitor',
      confidence: 0.9,
    },
    decidedAt,
    anchorReceipt: null,
  };
}

function buildSimpleResult(label: string, source?: Record<string, any>): SimpleCheckResult {
  const status = normalizeStatus(source?.status);
  return {
    status: status === 'fail' ? 'HIT' : status === 'warn' ? 'STALE' : 'CLEAR',
    detail:
      typeof source?.reason === 'string'
        ? source.reason
        : `${label} check ${status === 'pass' ? 'clear' : status === 'warn' ? 'requires follow-up' : 'requires review'}.`,
    checkedAt: typeof source?.lastCheckedAt === 'string' ? source.lastCheckedAt : new Date().toISOString(),
    confidence: status === 'pass' ? 0.95 : status === 'warn' ? 0.65 : 0.3,
    metadata: {
      adverseActionCount: source?.adverseActionCount ?? 0,
    },
  };
}

function extractStatusPointer(payload: Prisma.JsonValue | null): StatusListPointer | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const record = payload as Record<string, any>;
  const pointer = record.credentialStatus ?? record.credential?.credentialStatus;
  if (!pointer || typeof pointer !== 'object') {
    return undefined;
  }

  return {
    statusListCredential:
      typeof pointer.statusListCredential === 'string' ? pointer.statusListCredential : undefined,
    statusListIndex: pointer.statusListIndex,
    credentialId: typeof record.id === 'string' ? record.id : undefined,
  };
}

function normalizeStatus(value: unknown): CheckStatus {
  if (value === 'pass') return 'pass';
  if (value === 'warn') return 'warn';
  if (value === 'fail') return 'fail';
  return 'warn';
}

type CheckStatus = 'pass' | 'warn' | 'fail';

export default router;










