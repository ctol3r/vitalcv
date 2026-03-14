import { Prisma, PrismaClient } from '@prisma/client';
import { invalidateTrustStateCache } from '../services/trust/trustStateCache';

const prisma = new PrismaClient();

const INVALIDATION_ACTIONS = new Set(['create', 'update', 'upsert', 'delete']);

function readStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function extractTrustStateCacheKey(
  params: Prisma.MiddlewareParams,
  result: unknown,
): string | null {
  if (params.model === 'CandidateCredential') {
    const candidate = result as { clinicianId?: unknown } | null;
    return (
      readStringValue(candidate?.clinicianId)
      ?? readStringValue((params.args as { data?: { clinicianId?: unknown } } | undefined)?.data?.clinicianId)
      ?? readStringValue((params.args as { where?: { clinicianId?: unknown } } | undefined)?.where?.clinicianId)
    );
  }

  if (params.model === 'VerificationArtifact') {
    const artifact = result as { npi?: unknown } | null;
    return (
      readStringValue(artifact?.npi)
      ?? readStringValue((params.args as { data?: { npi?: unknown } } | undefined)?.data?.npi)
      ?? readStringValue((params.args as { where?: { npi?: unknown } } | undefined)?.where?.npi)
    );
  }

  return null;
}

prisma.$use(async (params, next) => {
  const result = await next(params);

  if (
    params.model
    && INVALIDATION_ACTIONS.has(params.action)
    && (params.model === 'CandidateCredential' || params.model === 'VerificationArtifact')
  ) {
    const cacheKey = extractTrustStateCacheKey(params, result);
    if (cacheKey) {
      invalidateTrustStateCache(cacheKey);
    }
  }

  return result;
});

export { Prisma, PrismaClient };
export default prisma;
