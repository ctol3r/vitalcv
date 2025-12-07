import { Router, type Request, type Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { DEFAULT_WEIGHTS } from '../../services/matching/engine';
import { indexJobPosting } from '../../services/jobs/extract-keywords';

const router = Router();
const prisma = new PrismaClient();
const MAX_SEARCH_RESULTS = 25;
type JobRecord = Prisma.JobPostingGetPayload<{}> & {
  createdAt: Date;
  updatedAt: Date;
  requiredStates?: string[] | null;
  telehealth?: boolean | null;
  modality?: string | null;
};

router.get('/jobs/search', async (req: Request, res: Response) => {
  const query = String(req.query.q ?? '').trim();
  const limit = normalizeLimit(req.query.limit);

  if (!query) {
    return res.status(400).json({
      error: 'query_required',
      message: 'Search query parameter q is required',
    });
  }

  try {
    const tokenized = tokenizeSearchQuery(query);
    if (tokenized.normalized.length === 0) {
      return res.status(400).json({
        error: 'query_terms_invalid',
        message: 'Unable to derive search terms from query',
      });
    }

    let indexRecords = await prisma.jobSearchIndex.findMany({
      where: {
        keywords: { hasSome: tokenized.keywordFilters },
      },
      orderBy: { createdAt: 'desc' },
      take: limit * 5,
    });

    if (indexRecords.length === 0) {
      const recentJobs = await prisma.jobPosting.findMany({
        orderBy: { createdAt: 'desc' },
        take: 25,
      });
      await Promise.all(
        recentJobs.map((job) =>
          indexJobPosting(prisma, job.id).catch((error) => {
            console.warn('[Jobs/Search] Failed to index job', job.id, error);
          }),
        ),
      );
      indexRecords = await prisma.jobSearchIndex.findMany({
        where: {
          keywords: { hasSome: tokenized.keywordFilters },
        },
        orderBy: { createdAt: 'desc' },
        take: limit * 5,
      });
    }

    if (indexRecords.length === 0) {
      return res.json({
        query,
        matches: [],
        weights: DEFAULT_WEIGHTS,
        totalConsidered: 0,
      });
    }

    const jobs = await prisma.jobPosting.findMany({
      where: {
        id: { in: indexRecords.map((record) => record.jobId) },
        status: { not: 'closed' },
      },
    });
    const jobMap = new Map(jobs.map((job) => [job.id, job as JobRecord]));

    const ranked = indexRecords
      .map((record) => {
        const job = jobMap.get(record.jobId);
        if (!job) {
          return null;
        }
        const score = scoreJobMatch(job, record.keywords, tokenized);
        return { job, score };
      })
      .filter((entry): entry is { job: typeof jobs[number]; score: MatchScore } => Boolean(entry))
      .sort((a, b) => b.score.total - a.score.total)
      .slice(0, limit)
      .map(({ job, score }) => serializeJob(job, score));

    return res.json({
      query,
      weights: DEFAULT_WEIGHTS,
      totalConsidered: jobMap.size,
      matches: ranked,
    });
  } catch (error) {
    console.error('[Jobs/Search] search failed', error);
    return res.status(500).json({
      error: 'job_search_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

function normalizeLimit(rawLimit: unknown): number {
  const parsed = Number.parseInt(String(rawLimit ?? '10'), 10);
  if (!Number.isFinite(parsed)) {
    return 10;
  }
  return Math.max(1, Math.min(parsed, MAX_SEARCH_RESULTS));
}

interface TokenizedQuery {
  rawTerms: string[];
  normalized: string[];
  keywordFilters: string[];
  specialtyTerms: string[];
  regionTerms: string[];
  modifiers: string[];
}

function tokenizeSearchQuery(query: string): TokenizedQuery {
  const parts = query
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const normalized: string[] = [];
  const specialtyTerms: string[] = [];
  const regionTerms: string[] = [];
  const modifiers: string[] = [];

  parts.forEach((part) => {
    const lower = part.toLowerCase();
    if (lower.length === 2 && /^[a-z]{2}$/i.test(part)) {
      regionTerms.push(part.toUpperCase());
      normalized.push(`region:${part.toUpperCase()}`);
      return;
    }
    if (lower.includes('tele')) {
      modifiers.push('modality:telehealth');
      normalized.push('modality:telehealth');
      return;
    }
    if (lower.includes('compact')) {
      modifiers.push('compact:preferred');
      normalized.push('compact:preferred');
      return;
    }
    specialtyTerms.push(lower);
    normalized.push(`specialty:${lower.replace(/\s+/g, '-')}`);
  });

  const keywordFilters = [
    ...normalized,
    ...regionTerms.map((state) => `region:${state}`),
    ...specialtyTerms.map((term) => term.replace(/\s+/g, '-')),
  ];

  return {
    rawTerms: parts,
    normalized,
    keywordFilters: Array.from(new Set(keywordFilters)),
    specialtyTerms,
    regionTerms,
    modifiers,
  };
}

interface MatchScore {
  total: number;
  specialty: number;
  region: number;
  modality: number;
  coverage: number;
  recency: number;
}

function scoreJobMatch(
  job: JobRecord,
  keywords: string[],
  query: TokenizedQuery,
): MatchScore {
  const keywordSet = new Set(keywords);
  const matched = query.keywordFilters.filter((token) => keywordSet.has(token));
  const coverage = matched.length / Math.max(1, query.keywordFilters.length);

  const specialtyHit = query.specialtyTerms.some((term) =>
    keywordSet.has(`specialty:${term.replace(/\s+/g, '-')}`),
  )
    ? 1
    : 0.2;
  const regionHit =
    query.regionTerms.length === 0
      ? 0.6
      : query.regionTerms.filter((region) => keywordSet.has(`region:${region}`)).length /
        query.regionTerms.length;
  const modalityHit = query.modifiers.some((modifier) => keywordSet.has(modifier)) ? 1 : 0.4;
  const recency = computeRecencyBoost((job as any).createdAt);

  const total =
    specialtyHit * DEFAULT_WEIGHTS.specialty +
    regionHit * DEFAULT_WEIGHTS.compact +
    modalityHit * (DEFAULT_WEIGHTS.experience * 0.5) +
    coverage * DEFAULT_WEIGHTS.sanctions +
    recency * DEFAULT_WEIGHTS.recency;

  return {
    total,
    specialty: specialtyHit,
    region: regionHit,
    modality: modalityHit,
    coverage,
    recency,
  };
}

function computeRecencyBoost(createdAt: unknown): number {
  const timestamp = createdAt instanceof Date ? createdAt.getTime() : Date.parse(String(createdAt));
  if (Number.isNaN(timestamp)) {
    return 0.4;
  }
  const days = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
  if (days <= 7) return 1;
  if (days <= 30) return 0.85;
  if (days <= 90) return 0.7;
  if (days <= 180) return 0.55;
  return 0.35;
}

function serializeJob(job: JobRecord, score: MatchScore) {
  const requiredStates = Array.isArray(job.requiredStates) ? job.requiredStates : [];
  return {
    jobId: job.id,
    title: job.title,
    organization: job.partnerId,
    specialty: job.specialty,
    states: requiredStates,
    telehealth: job.telehealth ?? false,
    compactPreferred: requiredStates.length > 1 || job.telehealth === true,
    score: Number((score.total * 100).toFixed(1)),
    createdAt: job.createdAt,
    highlights: {
      specialty: score.specialty,
      region: score.region,
      coverage: score.coverage,
      recency: score.recency,
    },
  };
}

export default router;


