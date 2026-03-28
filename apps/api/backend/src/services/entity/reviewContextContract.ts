import type { VcvOrgContextStatus, VcvOrgContextType } from '@prisma/client';
import prisma from '../../graphql/prisma_client';

const URL_RE = /^https?:\/\/.+/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class OrganizationContextValidationError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'OrganizationContextValidationError';
  }
}

export interface OrganizationContextInput {
  organizationContextId?: string;
  organization_id?: string;
  name?: string;
  callback_url?: string;
  purpose_of_use?: string;
}

export interface ResolvedShareOrganizationContext {
  source: 'bundle_fallback' | 'employer_request_context';
  organizationContextId: string | null;
  requestorEntityId: string | null;
  organizationId: string;
  organizationName: string;
  callbackUrl: string | null;
  purposeOfUse: string;
  contextType: VcvOrgContextType | null;
  status: VcvOrgContextStatus | null;
}

type PersistedOrganizationContextRecord = {
  id: string;
  requestorId: string;
  contextType: VcvOrgContextType;
  status: VcvOrgContextStatus;
  title: string | null;
  description: string | null;
  webhookUrl: string | null;
  requestor: {
    id: string;
    displayName: string;
  };
};

function normalizeString(value: unknown): string | null {
  if (
    typeof value !== 'string'
    && typeof value !== 'number'
    && typeof value !== 'boolean'
    && typeof value !== 'bigint'
  ) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateOptionalCallbackUrl(value: unknown): string | undefined {
  const callbackUrl = normalizeString(value);
  if (!callbackUrl) return undefined;
  if (!URL_RE.test(callbackUrl)) {
    throw new OrganizationContextValidationError(
      'organization_context.callback_url must be a valid https:// URL.',
    );
  }
  return callbackUrl;
}

export function readOptionalOrganizationContextId(value: unknown): string | undefined {
  const organizationContextId = normalizeString(value);
  if (!organizationContextId) return undefined;
  if (!UUID_RE.test(organizationContextId)) {
    throw new OrganizationContextValidationError(
      'organizationContextId must be a valid UUID.',
    );
  }
  return organizationContextId;
}

export function validateOrganizationContext(input: unknown): OrganizationContextInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new OrganizationContextValidationError('organization_context is required.');
  }

  const record = input as Record<string, unknown>;
  const organizationContextId = readOptionalOrganizationContextId(
    record.organization_context_id ?? record.organizationContextId,
  );
  const callbackUrl = validateOptionalCallbackUrl(record.callback_url);
  const organizationId = normalizeString(record.organization_id);
  const name = normalizeString(record.name);
  const purposeOfUse = normalizeString(record.purpose_of_use);

  if (organizationContextId) {
    if (organizationId && organizationId.length > 256) {
      throw new OrganizationContextValidationError('organization_context.organization_id too long.');
    }
    if (name && name.length > 256) {
      throw new OrganizationContextValidationError('organization_context.name too long.');
    }
    if (purposeOfUse && purposeOfUse.length > 512) {
      throw new OrganizationContextValidationError('organization_context.purpose_of_use too long.');
    }

    return {
      organizationContextId,
      ...(organizationId ? { organization_id: organizationId } : {}),
      ...(name ? { name } : {}),
      ...(callbackUrl ? { callback_url: callbackUrl } : {}),
      ...(purposeOfUse ? { purpose_of_use: purposeOfUse } : {}),
    };
  }

  if (!organizationId) {
    throw new OrganizationContextValidationError('organization_context.organization_id is required.');
  }
  if (organizationId.length > 256) {
    throw new OrganizationContextValidationError('organization_context.organization_id too long.');
  }
  if (!name) {
    throw new OrganizationContextValidationError('organization_context.name is required.');
  }
  if (name.length > 256) {
    throw new OrganizationContextValidationError('organization_context.name too long.');
  }
  if (!purposeOfUse) {
    throw new OrganizationContextValidationError('organization_context.purpose_of_use is required.');
  }
  if (purposeOfUse.length > 512) {
    throw new OrganizationContextValidationError('organization_context.purpose_of_use too long.');
  }

  return {
    organization_id: organizationId,
    name,
    ...(callbackUrl ? { callback_url: callbackUrl } : {}),
    purpose_of_use: purposeOfUse,
  };
}

function buildContextPurpose(context: PersistedOrganizationContextRecord): string {
  return normalizeString(context.title)
    ?? normalizeString(context.description)
    ?? context.contextType;
}

async function loadPersistedOrganizationContext(
  organizationContextId: string,
): Promise<PersistedOrganizationContextRecord | null> {
  return prisma.vcvOrganizationContext.findUnique({
    where: { id: organizationContextId },
    select: {
      id: true,
      requestorId: true,
      contextType: true,
      status: true,
      title: true,
      description: true,
      webhookUrl: true,
      requestor: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  });
}

export async function resolvePersistedOrganizationContext(
  organizationContextId: string,
): Promise<ResolvedShareOrganizationContext> {
  const context = await loadPersistedOrganizationContext(organizationContextId);
  if (!context) {
    throw new OrganizationContextValidationError(
      'organization_context.organization_context_id is invalid.',
    );
  }

  return {
    source: 'employer_request_context',
    organizationContextId: context.id,
    requestorEntityId: context.requestorId,
    organizationId: context.requestor.id,
    organizationName: context.requestor.displayName,
    callbackUrl: context.webhookUrl,
    purposeOfUse: buildContextPurpose(context),
    contextType: context.contextType,
    status: context.status,
  };
}

export async function resolveShareOrganizationContext(
  input: OrganizationContextInput,
): Promise<ResolvedShareOrganizationContext> {
  if (input.organizationContextId) {
    const context = await resolvePersistedOrganizationContext(input.organizationContextId);
    return {
      ...context,
      callbackUrl: context.callbackUrl ?? input.callback_url ?? null,
    };
  }

  if (!input.organization_id || !input.name || !input.purpose_of_use) {
    throw new OrganizationContextValidationError('organization_context is required.');
  }

  return {
    source: 'bundle_fallback',
    organizationContextId: null,
    requestorEntityId: null,
    organizationId: input.organization_id,
    organizationName: input.name,
    callbackUrl: input.callback_url ?? null,
    purposeOfUse: input.purpose_of_use,
    contextType: null,
    status: null,
  };
}
