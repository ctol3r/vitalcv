import { Router } from 'express';
import prisma from '../graphql/prisma_client';
import { logMatchComputed } from '../audit/auditScrapbook';
import { generateExplanations, topExplanationMessages } from '../matching/explanations';
import { cosineSimilarity, score, FeatureScores } from '../matching/score';

const router = Router();

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter(Boolean);
}

function intersectionCount(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const token of a) {
    if (b.has(token)) count += 1;
  }
  return count;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

router.get('/matches', async (req, res) => {
  const clinicianIdRaw = String(req.query.clinicianId || '').trim();
  const clinicianId = Number(clinicianIdRaw);
  if (!clinicianIdRaw || !Number.isInteger(clinicianId) || clinicianId <= 0) {
    return res.status(400).json({ error: 'clinicianId is required and must be a number' });
  }

  const clinician = await prisma.user.findUnique({ where: { id: clinicianId } });
  if (!clinician) {
    return res.status(404).json({ error: 'Clinician not found' });
  }

  const credentials = await prisma.credential.findMany({
    where: { userId: clinicianId },
  });

  const jobs = await prisma.job.findMany();

  const credentialNames = credentials.map((credential) => credential.name);
  const credentialTokenSets = credentialNames.map((name) => new Set(tokenize(name)));

  const matches = jobs.map((job) => {
    const jobTokens = new Set(tokenize(job.title));
    const credentialOverlap: string[] = [];

    credentialTokenSets.forEach((tokenSet, index) => {
      if (intersectionCount(tokenSet, jobTokens) > 0) {
        credentialOverlap.push(credentialNames[index]);
      }
    });

    const overlapRatio =
      credentialOverlap.length === 0
        ? 0
        : credentialOverlap.length / Math.max(1, credentialNames.length);

    const features: FeatureScores = {
      specialtyMatch: clamp(overlapRatio),
      locationProximity: 0.5,
      experienceYears: 0.5,
      rating: 0.5,
      burnoutRisk: 0.5,
    };

    const credentialCountNormalized = clamp(credentialNames.length / 10);
    const jobTokenCountNormalized = clamp(jobTokens.size / 10);
    const clinicianVector = [overlapRatio, credentialCountNormalized, 1];
    const jobVector = [overlapRatio, jobTokenCountNormalized, 1];
    const embeddingSimilarity = cosineSimilarity(clinicianVector, jobVector);

    const matchScore = score(clinicianVector, jobVector, features);
    const explanations = generateExplanations(features, embeddingSimilarity);

    return {
      jobId: job.id,
      jobTitle: job.title,
      score: Number(matchScore.toFixed(4)),
      explanation: topExplanationMessages(explanations),
      readinessPercent: Math.round(matchScore * 100),
      credentialOverlap,
    };
  });

  const sorted = matches.sort((a, b) => b.score - a.score);

  await Promise.all(
    sorted.map((match) =>
      logMatchComputed({
        clinicianId,
        jobId: match.jobId,
        score: match.score,
        credentialOverlap: match.credentialOverlap,
      }),
    ),
  );

  return res.json(
    sorted.map(({ credentialOverlap, ...match }) => match),
  );
});

export default router;
