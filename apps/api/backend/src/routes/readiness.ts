import { Router } from 'express';
import { neo4jConfigured } from '../graph/neo4jHttp';
import { getReadinessScore } from '../graph/service';
import prisma from '../graphql/prisma_client';

const router = Router();

const REQUIRED_CREDENTIAL_TYPES = [
  'Medical License',
  'Board Certification',
  'BLS Certification',
  'DEA Registration',
  'Background Check',
];

const EXPIRY_YEARS = 2;
const PENDING_WINDOW_DAYS = 14;

type CredentialSnapshot = {
  type: string;
  issuedAt: string;
};

function normalizeType(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function matchesRequiredType(credentialName: string, requiredType: string): boolean {
  return normalizeType(credentialName).includes(normalizeType(requiredType));
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

router.get('/readiness', async (req, res) => {
  const clinicianId = String(req.query.clinicianId || '').trim();
  if (!clinicianId) return res.status(400).json({ error: 'clinicianId is required' });

  const numericId = Number(clinicianId);
  const orFilters: Array<{ id?: number; email?: string; name?: string }> = [];
  if (Number.isInteger(numericId) && numericId > 0) {
    orFilters.push({ id: numericId });
  }
  orFilters.push({ email: clinicianId }, { name: clinicianId });

  const user = await prisma.user.findFirst({
    where: { OR: orFilters },
    include: { credentials: true },
  });

  const credentials = user?.credentials ?? [];
  const missingTypes = REQUIRED_CREDENTIAL_TYPES.filter(
    (required) => !credentials.some((credential) => matchesRequiredType(credential.name, required)),
  );

  const now = Date.now();
  const expiryCutoff = now - EXPIRY_YEARS * 365 * 24 * 60 * 60 * 1000;
  const pendingCutoff = now - PENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const expiredCredentials: CredentialSnapshot[] = credentials
    .filter((credential) => credential.issuedAt.getTime() < expiryCutoff)
    .map((credential) => ({
      type: credential.name,
      issuedAt: credential.issuedAt.toISOString(),
    }));

  const verificationPendingItems: CredentialSnapshot[] = credentials
    .filter((credential) => credential.issuedAt.getTime() >= pendingCutoff)
    .map((credential) => ({
      type: credential.name,
      issuedAt: credential.issuedAt.toISOString(),
    }));

  let baseScore = 70;
  if (neo4jConfigured()) {
    try {
      const graphScore = await getReadinessScore(clinicianId);
      baseScore = graphScore.score;
    } catch {
      baseScore = 70;
    }
  }

  const readinessPercent = clampScore(
    baseScore - missingTypes.length * 12 - expiredCredentials.length * 18 - verificationPendingItems.length * 5,
  );

  const suggestedNextSteps: string[] = [];
  if (missingTypes.length) {
    suggestedNextSteps.push(
      `Upload or verify ${missingTypes.slice(0, 2).join(' and ')} to improve readiness.`,
    );
  }
  if (expiredCredentials.length) {
    suggestedNextSteps.push('Renew expired credentials and resubmit for verification.');
  }
  if (verificationPendingItems.length) {
    suggestedNextSteps.push('Complete verification for pending items to unlock full readiness.');
  }
  if (suggestedNextSteps.length === 0) {
    suggestedNextSteps.push('All core requirements are met. You are ready to match with roles.');
  }

  return res.json({
    clinicianId,
    readinessPercent,
    missingCredentials: missingTypes.map((type) => ({ type, count: 1 })),
    verificationPendingItems,
    expiredCredentials,
    suggestedNextSteps,
    factors: {
      baseScore,
      requiredCredentialCount: REQUIRED_CREDENTIAL_TYPES.length,
      missingCount: missingTypes.length,
      expiredCount: expiredCredentials.length,
      pendingCount: verificationPendingItems.length,
    },
  });
});

export { router as readinessRouter };
