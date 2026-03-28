import prisma from '../../graphql/prisma_client';
import {
  OrganizationContextValidationError,
  resolvePersistedOrganizationContext,
} from './reviewContextContract';

export type EmployerReviewAttributionSource =
  | 'organization_context'
  | 'bundle_share'
  | 'unscoped';

export interface EmployerReviewAttribution {
  source: EmployerReviewAttributionSource;
  organizationContextId: string | null;
  bundleShareEventId: string | null;
  bundleId: string | null;
  requestorEntityId: string | null;
  organizationId: string | null;
  organizationName: string | null;
  purposeOfUse: string | null;
}

export class EmployerReviewAttributionError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'EmployerReviewAttributionError';
    this.statusCode = statusCode;
  }
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function buildUnscopedAttribution(): EmployerReviewAttribution {
  return {
    source: 'unscoped',
    organizationContextId: null,
    bundleShareEventId: null,
    bundleId: null,
    requestorEntityId: null,
    organizationId: null,
    organizationName: null,
    purposeOfUse: null,
  };
}

function inferAttributionSource(input: {
  source?: unknown;
  organizationContextId: string | null;
  bundleShareEventId: string | null;
  bundleId: string | null;
}): EmployerReviewAttributionSource {
  switch (input.source) {
    case 'organization_context':
    case 'bundle_share':
    case 'unscoped':
      return input.source;
    default:
      if (input.organizationContextId) return 'organization_context';
      if (input.bundleShareEventId || input.bundleId) return 'bundle_share';
      return 'unscoped';
  }
}

function mergeAttribution(
  primary: EmployerReviewAttribution,
  secondary: EmployerReviewAttribution | null,
): EmployerReviewAttribution {
  if (!secondary) return primary;

  return {
    ...primary,
    bundleShareEventId: primary.bundleShareEventId ?? secondary.bundleShareEventId,
    bundleId: primary.bundleId ?? secondary.bundleId,
    requestorEntityId: primary.requestorEntityId ?? secondary.requestorEntityId,
    organizationId: primary.organizationId ?? secondary.organizationId,
    organizationName: primary.organizationName ?? secondary.organizationName,
    purposeOfUse: primary.purposeOfUse ?? secondary.purposeOfUse,
  };
}

async function loadOrganizationContextAttribution(
  entityId: string,
  organizationContextId: string,
): Promise<EmployerReviewAttribution> {
  let context;
  try {
    context = await resolvePersistedOrganizationContext(organizationContextId);
  } catch (error) {
    if (error instanceof OrganizationContextValidationError) {
      throw new EmployerReviewAttributionError(404, 'Review context not found.');
    }
    throw error;
  }

  if (context.requestorEntityId === entityId) {
    throw new EmployerReviewAttributionError(
      400,
      'Review context cannot target its requesting organization as the subject.',
    );
  }

  const [subjectLink, shareEvent] = await Promise.all([
    prisma.vcvOrgContextSubject.findUnique({
      where: {
        contextId_subjectId: {
          contextId: context.organizationContextId!,
          subjectId: entityId,
        },
      },
      select: { id: true },
    }),
    prisma.bundleShareEvent.findFirst({
      where: {
        subjectEntityId: entityId,
        organizationContextId,
      },
      orderBy: { sharedAt: 'desc' },
      select: { id: true },
    }),
  ]);

  if (!subjectLink && !shareEvent) {
    throw new EmployerReviewAttributionError(
      400,
      'Review context is not linked to this review subject.',
    );
  }

  return {
    source: 'organization_context',
    organizationContextId: context.organizationContextId,
    bundleShareEventId: null,
    bundleId: null,
    requestorEntityId: context.requestorEntityId,
    organizationId: context.organizationId,
    organizationName: readOptionalString(context.organizationName),
    purposeOfUse: readOptionalString(context.purposeOfUse),
  };
}

async function loadBundleShareAttribution(
  entityId: string,
  bundleId: string,
): Promise<EmployerReviewAttribution> {
  const share = await prisma.bundleShareEvent.findFirst({
    where: { bundleId },
    orderBy: { sharedAt: 'desc' },
    select: {
      id: true,
      bundleId: true,
      subjectEntityId: true,
      organizationContextId: true,
      organizationId: true,
      organizationName: true,
      purposeOfUse: true,
    },
  });

  if (!share) {
    throw new EmployerReviewAttributionError(404, 'Bundle review context not found.');
  }

  if (share.subjectEntityId && share.subjectEntityId !== entityId) {
    throw new EmployerReviewAttributionError(
      404,
      'Bundle review context does not match this review subject.',
    );
  }

  const organizationContext = share.organizationContextId
    ? await loadOrganizationContextAttribution(entityId, share.organizationContextId)
    : null;

  return mergeAttribution(
    {
      source: 'bundle_share',
      organizationContextId: organizationContext?.organizationContextId ?? share.organizationContextId,
      bundleShareEventId: share.id,
      bundleId: share.bundleId,
      requestorEntityId: organizationContext?.requestorEntityId ?? null,
      organizationId: organizationContext?.organizationId ?? share.organizationId,
      organizationName: organizationContext?.organizationName ?? share.organizationName,
      purposeOfUse: organizationContext?.purposeOfUse ?? share.purposeOfUse,
    },
    organizationContext,
  );
}

export async function resolveEmployerReviewAttribution(input: {
  entityId: string;
  organizationContextId?: unknown;
  bundleId?: unknown;
}): Promise<EmployerReviewAttribution> {
  const requestedContextId = readOptionalString(input.organizationContextId);
  const requestedBundleId = readOptionalString(input.bundleId);

  if (!requestedContextId && !requestedBundleId) {
    return buildUnscopedAttribution();
  }

  const [organizationContext, bundleShare] = await Promise.all([
    requestedContextId
      ? loadOrganizationContextAttribution(input.entityId, requestedContextId)
      : Promise.resolve<EmployerReviewAttribution | null>(null),
    requestedBundleId
      ? loadBundleShareAttribution(input.entityId, requestedBundleId)
      : Promise.resolve<EmployerReviewAttribution | null>(null),
  ]);

  if (
    organizationContext
    && bundleShare?.organizationContextId
    && bundleShare.organizationContextId !== organizationContext.organizationContextId
  ) {
    throw new EmployerReviewAttributionError(
      400,
      'Bundle review context does not match the requested organization context.',
    );
  }

  return mergeAttribution(
    organizationContext ?? bundleShare ?? buildUnscopedAttribution(),
    bundleShare,
  );
}

export function normalizeEmployerReviewAttribution(value: unknown): EmployerReviewAttribution {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return buildUnscopedAttribution();
  }

  const record = value as Record<string, unknown>;
  const organizationContextId = readOptionalString(record.organizationContextId);
  const bundleShareEventId = readOptionalString(record.bundleShareEventId);
  const bundleId = readOptionalString(record.bundleId);

  return {
    source: inferAttributionSource({
      source: record.source,
      organizationContextId,
      bundleShareEventId,
      bundleId,
    }),
    organizationContextId,
    bundleShareEventId,
    bundleId,
    requestorEntityId: readOptionalString(record.requestorEntityId),
    organizationId: readOptionalString(record.organizationId),
    organizationName: readOptionalString(record.organizationName),
    purposeOfUse: readOptionalString(record.purposeOfUse),
  };
}

export function matchesEmployerReviewAttribution(
  requested: EmployerReviewAttribution,
  stored: EmployerReviewAttribution,
): boolean {
  if (requested.organizationContextId && stored.organizationContextId) {
    return requested.organizationContextId === stored.organizationContextId;
  }

  if (requested.bundleShareEventId && stored.bundleShareEventId) {
    return requested.bundleShareEventId === stored.bundleShareEventId;
  }

  if (requested.bundleId && stored.bundleId) {
    return requested.bundleId === stored.bundleId;
  }

  if (requested.source === 'unscoped') {
    return stored.source === 'unscoped'
      && !stored.organizationContextId
      && !stored.bundleShareEventId
      && !stored.bundleId;
  }

  return false;
}
