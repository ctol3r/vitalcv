import { Router } from 'express';
import prisma from '../graphql/prisma_client';

const router = Router();

const DEFAULT_REQUIRED_CREDENTIALS = [
  'Medical License',
  'Board Certification',
  'BLS Certification',
  'DEA Registration',
];

function normalizeType(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function matchesRequiredType(credentialName: string, requiredType: string): boolean {
  return normalizeType(credentialName).includes(normalizeType(requiredType));
}

function resolveRequiredCredentials(jobTitle?: string | null): string[] {
  const normalizedTitle = normalizeType(jobTitle || '');
  if (!normalizedTitle) return DEFAULT_REQUIRED_CREDENTIALS;
  if (normalizedTitle.includes('nurse')) {
    return ['Nursing License', 'BLS Certification', 'ACLS Certification', 'Background Check'];
  }
  if (normalizedTitle.includes('pharmacist')) {
    return ['Pharmacy License', 'State Registration', 'BLS Certification', 'Background Check'];
  }
  if (normalizedTitle.includes('physician')) {
    return ['Medical License', 'Board Certification', 'DEA Registration', 'Background Check'];
  }
  return DEFAULT_REQUIRED_CREDENTIALS;
}

router.get('/analytics/match-gaps', async (req, res) => {
  const jobId = String(req.query.jobId || '').trim();
  if (!jobId) return res.status(400).json({ error: 'jobId is required' });

  const jobNumericId = Number(jobId);
  const job = Number.isInteger(jobNumericId)
    ? await prisma.job.findUnique({ where: { id: jobNumericId } })
    : null;

  const requiredCredentials = resolveRequiredCredentials(job?.title || jobId);
  const candidates = await prisma.user.findMany({ include: { credentials: true } });
  const candidateCount = candidates.length;

  const candidateStats = candidates.map((candidate) => {
    const matched = requiredCredentials.filter((required) =>
      candidate.credentials.some((credential) => matchesRequiredType(credential.name, required)),
    );
    const missing = requiredCredentials.filter((required) => !matched.includes(required));
    const matchScore = requiredCredentials.length ? matched.length / requiredCredentials.length : 0;
    return { candidateId: candidate.id, matchScore, missing };
  });

  const missingByCredential = requiredCredentials.map((credentialType) => {
    const missingCount = candidateStats.filter((candidate) =>
      candidate.missing.includes(credentialType),
    ).length;
    const missingPercent = candidateCount
      ? Math.round((missingCount / candidateCount) * 100)
      : 0;
    return { credentialType, missingCount, missingPercent, candidateCount };
  });

  const commonDisqualifiers = missingByCredential
    .filter((entry) => entry.missingPercent >= 50)
    .map((entry) => entry.credentialType);

  const nearMissProfiles = candidateStats
    .filter((candidate) => candidate.matchScore >= 0.8 && candidate.matchScore < 0.9)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5)
    .map((candidate) => ({
      candidateId: candidate.candidateId,
      matchScore: Math.round(candidate.matchScore * 100),
      missingCredentials: candidate.missing,
    }));

  const matchedCount = candidateStats.filter((candidate) => candidate.matchScore >= 0.9).length;
  const nearMatchCount = candidateStats.filter(
    (candidate) => candidate.matchScore >= 0.8 && candidate.matchScore < 0.9,
  ).length;

  return res.json({
    jobId,
    jobTitle: job?.title || null,
    requiredCredentials,
    candidateCount,
    missingByCredential,
    nearMissProfiles,
    commonDisqualifiers,
    funnel: {
      totalCandidates: candidateCount,
      matched: matchedCount,
      nearMatch: nearMatchCount,
      belowThreshold: Math.max(0, candidateCount - matchedCount - nearMatchCount),
    },
  });
});

export { router as analyticsRouter };
