import { Prisma, PrismaClient } from '@prisma/client';
import { invalidateGraphSnapshots } from '../services/graph-engine/invalidation';
import { createGraphNodeId } from '../services/graph-engine/ids';
import { invalidateGeospatialCache } from '../services/geospatial/geospatialCache';
import { invalidateTrustStateCache } from '../services/trust/trustStateCache';
import { recordDatabaseQuerySample } from '../qa/performanceWatchers';

const prisma = new PrismaClient();

type PrismaMiddlewareParams = {
  model?: string;
  action: string;
  args?: unknown;
};

const INVALIDATION_ACTIONS = new Set(['create', 'update', 'upsert', 'delete']);
const GRAPH_INVALIDATION_MODELS = new Set([
  'candidatecredential',
  'personprofile',
  'organization',
  'organizationprofile',
  'workspacemembership',
  'opportunity',
  'application',
  'verificationartifact',
  'decisioncapsule',
  'sourcerecord',
  'claimrecord',
  'searchobject',
]);
const GEOSPATIAL_INVALIDATION_MODELS = new Set([
  'institution',
  'providerlocation',
  'geographicboundary',
  'providerboundaryassignment',
  'claimrecord',
  'personprofile',
  'organizationprofile',
  'predictioninsight',
  'graphedge',
  'vcventity',
]);

function readStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readRecordValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function createClinicianGraphNodeId(npi: string): string {
  return createGraphNodeId({
    type: 'clinician',
    sourceKind: 'npi',
    sourceId: npi,
  });
}

function createOrganizationGraphNodeId(organizationId: string): string {
  return createGraphNodeId({
    type: 'organization',
    sourceKind: 'organization',
    sourceId: organizationId,
  });
}

function createProgramGraphNodeId(opportunityId: string): string {
  return createGraphNodeId({
    type: 'program',
    sourceKind: 'opportunity',
    sourceId: opportunityId,
  });
}

function createArtifactGraphNodeId(artifactId: string, artifactType: string | null): string {
  return createGraphNodeId({
    type: artifactType?.toLowerCase() === 'license' ? 'license' : 'artifact',
    sourceKind: 'verification_artifact',
    sourceId: artifactId,
  });
}

function createSourceGraphNodeId(sourceId: string): string {
  return createGraphNodeId({
    type: 'source',
    sourceKind: 'source',
    sourceId,
  });
}

function createDecisionGraphNodeId(decisionId: string): string {
  return createGraphNodeId({
    type: 'decision',
    sourceKind: 'decision_capsule',
    sourceId: decisionId,
  });
}

function createClaimGraphNodeId(claimRecordId: string): string {
  return createGraphNodeId({
    type: 'claim',
    sourceKind: 'claim_record',
    sourceId: claimRecordId,
  });
}

function createDocumentGraphNodeId(searchObjectId: string): string {
  return createGraphNodeId({
    type: 'document',
    sourceKind: 'search_object',
    sourceId: searchObjectId,
  });
}

function looksLikeNpi(value: string | null): value is string {
  return Boolean(value && /^[0-9]{10}$/.test(value));
}

async function resolveWorkspaceMembershipGraphNodes(
  prismaClient: PrismaClient,
  record: Record<string, unknown>,
): Promise<string[]> {
  const focusNodeIds = new Set<string>();
  const personProfileId = readStringValue(record.personProfileId);
  const organizationProfileId = readStringValue(record.organizationProfileId);

  if (personProfileId) {
    const personProfile = await prismaClient.personProfile.findUnique({
      where: { id: personProfileId },
      select: { npi: true },
    });
    const npi = personProfile?.npi ?? null;
    if (looksLikeNpi(npi)) {
      focusNodeIds.add(createClinicianGraphNodeId(npi));
    }
  }

  if (organizationProfileId) {
    const organizationProfile = await prismaClient.organizationProfile.findUnique({
      where: { id: organizationProfileId },
      select: { organizationId: true },
    });
    if (organizationProfile?.organizationId) {
      focusNodeIds.add(createOrganizationGraphNodeId(organizationProfile.organizationId));
    }
  }

  return [...focusNodeIds];
}

async function extractGraphInvalidationTargets(
  prismaClient: PrismaClient,
  params: PrismaMiddlewareParams,
  result: unknown,
): Promise<null | {
  reason: string;
  graphModes: Array<'knowledge' | 'trust' | 'blended'>;
  focusNodeIds: string[];
}> {
  const record = readRecordValue(result);
  const args = readRecordValue(params.args);
  const data = readRecordValue(args.data);
  const where = readRecordValue(args.where);
  const focusNodeIds = new Set<string>();
  const graphModes = new Set<'knowledge' | 'trust' | 'blended'>();
  const modelName = params.model?.toLowerCase();

  const addTrustModes = (): void => {
    graphModes.add('trust');
    graphModes.add('blended');
  };
  const addKnowledgeModes = (): void => {
    graphModes.add('knowledge');
    graphModes.add('blended');
  };

  switch (modelName) {
    case 'candidatecredential': {
      addTrustModes();
      break;
    }
    case 'personprofile': {
      addTrustModes();
      const npi = readStringValue(record.npi) ?? readStringValue(data.npi) ?? readStringValue(where.npi);
      if (looksLikeNpi(npi)) {
        focusNodeIds.add(createClinicianGraphNodeId(npi));
      }
      break;
    }
    case 'organization': {
      addTrustModes();
      const organizationId = readStringValue(record.id) ?? readStringValue(where.id);
      if (organizationId) {
        focusNodeIds.add(createOrganizationGraphNodeId(organizationId));
      }
      break;
    }
    case 'organizationprofile': {
      addTrustModes();
      const organizationId = readStringValue(record.organizationId) ?? readStringValue(data.organizationId);
      if (organizationId) {
        focusNodeIds.add(createOrganizationGraphNodeId(organizationId));
      }
      break;
    }
    case 'workspacemembership': {
      addTrustModes();
      for (const nodeId of await resolveWorkspaceMembershipGraphNodes(prismaClient, {
        ...record,
        ...data,
        ...where,
      })) {
        focusNodeIds.add(nodeId);
      }
      break;
    }
    case 'opportunity': {
      addTrustModes();
      const opportunityId = readStringValue(record.id) ?? readStringValue(where.id);
      const organizationId = readStringValue(record.organizationId) ?? readStringValue(data.organizationId);
      if (opportunityId) {
        focusNodeIds.add(createProgramGraphNodeId(opportunityId));
      }
      if (organizationId) {
        focusNodeIds.add(createOrganizationGraphNodeId(organizationId));
      }
      break;
    }
    case 'application': {
      addTrustModes();
      const npi = readStringValue(record.npi) ?? readStringValue(data.npi);
      const opportunityId = readStringValue(record.opportunityId) ?? readStringValue(data.opportunityId);
      if (looksLikeNpi(npi)) {
        focusNodeIds.add(createClinicianGraphNodeId(npi));
      }
      if (opportunityId) {
        focusNodeIds.add(createProgramGraphNodeId(opportunityId));
      }
      break;
    }
    case 'verificationartifact': {
      addTrustModes();
      const artifactId = readStringValue(record.id) ?? readStringValue(where.id);
      const npi = readStringValue(record.npi) ?? readStringValue(data.npi);
      const sourceId = readStringValue(record.source) ?? readStringValue(data.source);
      const artifactType = readStringValue(record.artifactType) ?? readStringValue(data.artifactType);
      if (artifactId) {
        focusNodeIds.add(createArtifactGraphNodeId(artifactId, artifactType));
      }
      if (looksLikeNpi(npi)) {
        focusNodeIds.add(createClinicianGraphNodeId(npi));
      }
      if (sourceId) {
        focusNodeIds.add(createSourceGraphNodeId(sourceId));
      }
      break;
    }
    case 'decisioncapsule': {
      addTrustModes();
      const decisionId = readStringValue(record.id) ?? readStringValue(where.id);
      const subjectNpi = readStringValue(record.subjectNpi) ?? readStringValue(data.subjectNpi);
      if (decisionId) {
        focusNodeIds.add(createDecisionGraphNodeId(decisionId));
      }
      if (looksLikeNpi(subjectNpi)) {
        focusNodeIds.add(createClinicianGraphNodeId(subjectNpi));
      }
      break;
    }
    case 'sourcerecord': {
      addTrustModes();
      const subjectNpi = readStringValue(record.subjectNpi) ?? readStringValue(data.subjectNpi);
      const sourceId = readStringValue(record.sourceId) ?? readStringValue(data.sourceId);
      if (looksLikeNpi(subjectNpi)) {
        focusNodeIds.add(createClinicianGraphNodeId(subjectNpi));
      }
      if (sourceId) {
        focusNodeIds.add(createSourceGraphNodeId(sourceId));
      }
      break;
    }
    case 'claimrecord': {
      addTrustModes();
      const claimRecordId = readStringValue(record.id) ?? readStringValue(where.id);
      const subjectNpi = readStringValue(record.subjectNpi) ?? readStringValue(data.subjectNpi);
      if (claimRecordId) {
        focusNodeIds.add(createClaimGraphNodeId(claimRecordId));
      }
      if (looksLikeNpi(subjectNpi)) {
        focusNodeIds.add(createClinicianGraphNodeId(subjectNpi));
      }
      break;
    }
    case 'searchobject': {
      addKnowledgeModes();
      const searchObjectId = readStringValue(record.id) ?? readStringValue(where.id);
      const referenceId = readStringValue(record.referenceId) ?? readStringValue(data.referenceId);
      if (searchObjectId) {
        focusNodeIds.add(createDocumentGraphNodeId(searchObjectId));
      }
      if (looksLikeNpi(referenceId)) {
        focusNodeIds.add(createClinicianGraphNodeId(referenceId));
      }
      break;
    }
    default:
      return null;
  }

  return {
    reason: `${params.model}:${params.action}`,
    graphModes: [...graphModes],
    focusNodeIds: [...focusNodeIds],
  };
}

function extractTrustStateCacheKey(
  params: PrismaMiddlewareParams,
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

const prismaWithMiddleware = prisma as PrismaClient & {
  $use?: (
    middleware: (
      params: PrismaMiddlewareParams,
      next: (params: PrismaMiddlewareParams) => Promise<unknown>,
    ) => Promise<unknown>,
  ) => void;
};

if (typeof prismaWithMiddleware.$use === 'function') {
  prismaWithMiddleware.$use(async (params, next) => {
    const startedAt = Date.now();
    const result = await next(params);
    const durationMs = Date.now() - startedAt;

    if (params.model) {
      recordDatabaseQuerySample({
        model: params.model,
        action: params.action,
        durationMs,
      });
    }

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

    if (
      params.model
      && INVALIDATION_ACTIONS.has(params.action)
      && GEOSPATIAL_INVALIDATION_MODELS.has(params.model.toLowerCase())
    ) {
      invalidateGeospatialCache('prisma_write', {
        model: params.model,
        action: params.action,
      });
    }

    if (
      params.model
      && INVALIDATION_ACTIONS.has(params.action)
      && GRAPH_INVALIDATION_MODELS.has(params.model.toLowerCase())
    ) {
      const targets = await extractGraphInvalidationTargets(prisma, params, result);
      if (targets) {
        await invalidateGraphSnapshots(prisma, {
          reason: targets.reason,
          graphModes: targets.graphModes,
          focusNodeIds: targets.focusNodeIds,
          invalidateGlobal: true,
          metadata: {
            model: params.model,
            action: params.action,
          },
        });
      }
    }

    return result;
  });
}

export { Prisma, PrismaClient };
export default prisma;
