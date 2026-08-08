import { auth } from '@clerk/nextjs/server';
import type {
  WorkspaceList,
  WorkspaceOrganizationProfile,
} from '@/types/workspace';
import type { RequestReviewErrorPayload } from '@/lib/request-review-contract';

import { BACKEND_URL as BACKEND } from '@/lib/backend-url';
import { applyIdentityHeaders } from '@/lib/auth/forwardIdentity';

type EmployerWorkspaceAuthBase = {
  email: string | null;
  userId: string | null;
};

type EmployerWorkspaceAuthenticatedBase = {
  email: string | null;
  userId: string;
  /**
   * Clerk session JWT, resolved once alongside `userId`.
   *
   * Every backend call from this module forwards `x-clerk-user-id`, and the
   * backend's verified-identity middleware 401s an identity header that
   * arrives without a matching verified bearer once
   * `CLERK_JWT_VERIFICATION=enforce`. Carrying the token on the context lets
   * the synchronous `buildEmployerWorkspaceHeaders` attach it without becoming
   * async for every caller. Null when minting failed — see the warn there.
   */
  token: string | null;
};

export type EmployerWorkspaceAuthContext =
  | (EmployerWorkspaceAuthBase & {
      status: 'missing_session';
    })
  | (EmployerWorkspaceAuthenticatedBase & {
      status: 'missing_workspace';
      workspace: WorkspaceList | null;
    })
  | (EmployerWorkspaceAuthenticatedBase & {
      status: 'workspace_lookup_failed';
      lookupStatus: number;
    })
  | (EmployerWorkspaceAuthenticatedBase & {
      status: 'ready';
      activeOrg: WorkspaceOrganizationProfile;
      workspace: WorkspaceList;
    });

type EmployerWorkspaceRequestorFailure = RequestReviewErrorPayload & {
  status: number;
};

export type EmployerWorkspaceRequestorContext =
  | {
      status: 'ready';
      workspace: WorkspaceList;
      activeOrg: WorkspaceOrganizationProfile;
      userId: string;
      email: string | null;
      requestorEntityId: string;
    }
  | {
      status: 'blocked';
      response: EmployerWorkspaceRequestorFailure;
    };

function parseSessionEmail(
  session: Awaited<ReturnType<typeof auth>>,
): string | null {
  const claims = session.sessionClaims as Record<string, unknown> | undefined;
  return typeof claims?.email === 'string' ? claims.email : null;
}

function findActiveEmployerOrg(
  workspace: WorkspaceList | null,
): WorkspaceOrganizationProfile | null {
  if (!workspace) {
    return null;
  }

  if (workspace.activePersona === 'CLINICIAN') {
    return null;
  }

  const activeOrgId = typeof workspace.activeOrgId === 'string'
    ? workspace.activeOrgId.trim()
    : '';
  if (!activeOrgId) {
    return null;
  }

  const membership = workspace.memberships.find((candidate) => (
    candidate.active
    && candidate.role !== 'HOLDER'
    && candidate.org.organizationId === activeOrgId
  ));

  return membership?.org ?? null;
}

function buildRequestReviewFailure(
  status: number,
  response: RequestReviewErrorPayload,
): EmployerWorkspaceRequestorContext {
  return {
    status: 'blocked',
    response: {
      status,
      ...response,
    },
  };
}

async function readJson<T>(response: Response): Promise<T | null> {
  return response.json().catch(() => null) as Promise<T | null>;
}

export async function resolveEmployerWorkspaceAuthContext(): Promise<EmployerWorkspaceAuthContext> {
  const session = await auth();
  const userId = session.userId ?? null;
  const email = parseSessionEmail(session);

  if (!userId) {
    return {
      status: 'missing_session',
      userId: null,
      email,
    };
  }

  // Mint the session bearer once and carry it on the context. Forwarding
  // x-clerk-user-id without it is a 401 under CLERK_JWT_VERIFICATION=enforce.
  let token: string | null = null;
  try {
    token = typeof session.getToken === 'function' ? await session.getToken() : null;
  } catch {
    token = null;
  }

  const headers = new Headers();
  await applyIdentityHeaders(headers, { userId, token });
  if (email) {
    headers.set('x-clerk-user-email', email);
  }

  let response: Response;
  try {
    response = await fetch(`${BACKEND}/api/me/workspaces`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return {
      status: 'workspace_lookup_failed',
      userId,
      email,
      token,
      lookupStatus: 503,
    };
  }

  if (!response.ok) {
    if (response.status >= 500) {
      return {
        status: 'workspace_lookup_failed',
        userId,
        email,
        token,
        lookupStatus: response.status,
      };
    }

    return {
      status: 'missing_workspace',
      userId,
      email,
      token,
      workspace: null,
    };
  }

  const workspace = await response.json().catch(() => null) as WorkspaceList | null;
  const activeOrg = findActiveEmployerOrg(workspace);
  if (!workspace || !activeOrg) {
    return {
      status: 'missing_workspace',
      userId,
      email,
      token,
      workspace,
    };
  }

  return {
    status: 'ready',
    userId,
    email,
    token,
    workspace,
    activeOrg,
  };
}

export async function resolveEmployerWorkspaceRequestorContext(): Promise<EmployerWorkspaceRequestorContext> {
  const authContext = await resolveEmployerWorkspaceAuthContext();

  if (authContext.status === 'missing_session') {
    return buildRequestReviewFailure(401, {
      code: 'EMPLOYER_SESSION_REQUIRED',
      error: 'Sign in with an employer workspace to request a review.',
      nextStep: 'sign_in',
    });
  }

  if (authContext.status === 'missing_workspace') {
    return buildRequestReviewFailure(403, {
      code: 'EMPLOYER_WORKSPACE_REQUIRED',
      error: 'Employer workspace required to request a review.',
      hint: 'Create or switch into an employer workspace before requesting a clinician review.',
      nextStep: 'create_workspace',
    });
  }

  if (authContext.status === 'workspace_lookup_failed') {
    return buildRequestReviewFailure(authContext.lookupStatus, {
      code: 'EMPLOYER_WORKSPACE_LOOKUP_FAILED',
      error: 'Employer workspace lookup unavailable.',
      hint: 'Try again once workspace services are available.',
      nextStep: 'retry_request_review',
    });
  }

  if (authContext.status !== 'ready') {
    return buildRequestReviewFailure(503, {
      code: 'EMPLOYER_WORKSPACE_LOOKUP_FAILED',
      error: 'Employer workspace lookup unavailable.',
      hint: 'Try again once workspace services are available.',
      nextStep: 'retry_request_review',
    });
  }

  const readyAuthContext: Extract<EmployerWorkspaceAuthContext, { status: 'ready' }> = authContext;
  const employerWorkspaceNpi = readyAuthContext.activeOrg.npi?.trim() ?? '';
  if (!/^\d{10}$/.test(employerWorkspaceNpi)) {
    return buildRequestReviewFailure(409, {
      code: 'EMPLOYER_WORKSPACE_IDENTITY_REQUIRED',
      error: 'Employer workspace is missing a resolvable organization NPI.',
      hint: 'Add a valid Type 2 NPI to the active employer workspace before requesting a clinician review.',
      nextStep: 'complete_workspace_identity',
    });
  }

  if (readyAuthContext.activeOrg.npiType && readyAuthContext.activeOrg.npiType !== 'TYPE_2') {
    return buildRequestReviewFailure(409, {
      code: 'EMPLOYER_WORKSPACE_IDENTITY_REQUIRED',
      error: 'Employer workspace must use a Type 2 organization NPI.',
      hint: 'Update the active employer workspace to a Type 2 organization NPI before requesting a clinician review.',
      nextStep: 'complete_workspace_identity',
    });
  }

  try {
    const entityRes = await fetch(`${BACKEND}/api/entity/resolve/npi/${employerWorkspaceNpi}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    const entityPayload = await readJson<{
      entity?: {
        id?: string;
        npiType?: string;
      };
      error?: string;
    }>(entityRes);

    if (!entityRes.ok) {
      return buildRequestReviewFailure(
        entityRes.status >= 500 ? entityRes.status : 409,
        {
          code: entityRes.status >= 500
            ? 'EMPLOYER_WORKSPACE_LOOKUP_FAILED'
            : 'EMPLOYER_REQUESTOR_ENTITY_REQUIRED',
          error: entityRes.status >= 500
            ? 'Employer workspace requestor lookup unavailable.'
            : (entityPayload?.error ?? 'Employer workspace could not be linked to a requestor entity.'),
          hint: entityRes.status >= 500
            ? 'Try again once workspace services are available.'
            : 'Complete employer workspace setup with a valid Type 2 NPI so VitalCV can resolve the requestor entity.',
          nextStep: entityRes.status >= 500 ? 'retry_request_review' : 'complete_workspace_identity',
        },
      );
    }

    const resolvedEntity = entityPayload?.entity;
    const requestorEntityId = resolvedEntity?.id?.trim();
    if (!requestorEntityId || resolvedEntity?.npiType !== 'TYPE_2') {
      return buildRequestReviewFailure(409, {
        code: 'EMPLOYER_REQUESTOR_ENTITY_REQUIRED',
        error: 'Employer workspace could not be linked to a valid employer requestor entity.',
        hint: 'Complete employer workspace setup with a valid Type 2 NPI so VitalCV can resolve the requestor entity.',
        nextStep: 'complete_workspace_identity',
      });
    }

    return {
      status: 'ready',
      workspace: readyAuthContext.workspace,
      activeOrg: readyAuthContext.activeOrg,
      userId: readyAuthContext.userId,
      email: readyAuthContext.email,
      requestorEntityId,
    };
  } catch {
    return buildRequestReviewFailure(503, {
      code: 'EMPLOYER_WORKSPACE_LOOKUP_FAILED',
      error: 'Employer workspace requestor lookup unavailable.',
      hint: 'Try again once workspace services are available.',
      nextStep: 'retry_request_review',
    });
  }
}

export function buildEmployerWorkspaceHeaders(
  context: Extract<EmployerWorkspaceAuthContext, { status: 'ready' }>,
  init?: HeadersInit,
): Headers {
  const headers = new Headers(init);
  if (context.userId) {
    headers.set('x-clerk-user-id', context.userId);
    // Pair the identity header with the bearer resolved at context time. The
    // backend rejects the header alone under enforce; sending it unpaired
    // would 401 every employer request the moment that flag flips.
    if (context.token) {
      headers.set('Authorization', `Bearer ${context.token}`);
    } else {
      console.warn(
        JSON.stringify({
          event: 'identity_header_without_bearer',
          where: 'buildEmployerWorkspaceHeaders',
          detail: 'forwarding x-clerk-user-id with no session token; this 401s under CLERK_JWT_VERIFICATION=enforce',
        }),
      );
    }
  }
  headers.set('x-org-id', context.activeOrg.organizationId);

  if (context.email) {
    headers.set('x-clerk-user-email', context.email);
  }

  return headers;
}
