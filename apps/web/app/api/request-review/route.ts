import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  resolveEmployerWorkspaceAuthContext,
} from '@/lib/server/employer-workspace';

export const runtime = 'nodejs';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

const NPI_RE = /^\d{10}$/;

function jsonError(
  body: Record<string, unknown>,
  status: number,
) {
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session.userId) {
    return jsonError(
      { error: 'Sign in with an employer workspace to request a review.' },
      401,
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || !body.npi) {
    return jsonError({ error: 'npi is required.' }, 400);
  }

  const { npi, contextType = 'EMPLOYMENT_REVIEW', title, description } = body as {
    npi: string;
    contextType?: string;
    title?: string;
    description?: string;
  };

  if (!NPI_RE.test(npi)) {
    return jsonError({ error: 'npi must be a 10-digit number.' }, 400);
  }

  const workspaceContext = await resolveEmployerWorkspaceAuthContext();
  if (workspaceContext.status === 'missing_workspace') {
    return jsonError(
      {
        error: 'Employer workspace required to request a review.',
        hint: 'Create or switch into an employer workspace before requesting a clinician review.',
      },
      403,
    );
  }

  if (workspaceContext.status === 'workspace_lookup_failed') {
    return jsonError(
      { error: 'Employer workspace lookup unavailable.' },
      workspaceContext.lookupStatus,
    );
  }

  if (workspaceContext.status === 'missing_session') {
    return jsonError(
      { error: 'Sign in with an employer workspace to request a review.' },
      401,
    );
  }

  const employerWorkspaceNpi = workspaceContext.activeOrg.npi?.trim() ?? '';
  if (!NPI_RE.test(employerWorkspaceNpi)) {
    return jsonError(
      {
        error: 'Employer workspace is missing a resolvable organization NPI.',
        hint: 'Add a valid Type 2 NPI to the active employer workspace before requesting a clinician review.',
      },
      409,
    );
  }

  const requestorEntityRes = await fetch(`${B}/api/entity/resolve/npi/${employerWorkspaceNpi}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  if (!requestorEntityRes.ok) {
    return jsonError(
      { error: 'Employer workspace could not be linked to a requestor entity.' },
      requestorEntityRes.status,
    );
  }

  const requestorEntityPayload = await requestorEntityRes.json().catch(() => ({})) as {
    entity?: {
      id?: string;
      npiType?: string;
    };
  };
  const requestorEntityId = requestorEntityPayload.entity?.id?.trim();
  if (!requestorEntityId) {
    return jsonError(
      { error: 'Employer workspace entity resolution returned no entity id.' },
      502,
    );
  }

  const passportRes = await fetch(`${B}/api/passport/npi/${npi}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });

  if (!passportRes.ok) {
    if (passportRes.status === 404) {
      return jsonError(
        { error: 'No passport found for that NPI. The clinician must run a readiness check first.' },
        404,
      );
    }
    return jsonError(
      { error: 'Could not resolve passport for that NPI.' },
      passportRes.status,
    );
  }

  const passport = await passportRes.json() as {
    entityId: string;
    identity?: { displayName?: string };
  };
  const entityId = passport.entityId;
  if (!entityId) {
    return jsonError({ error: 'Passport found but entity ID is missing.' }, 500);
  }

  const orgRes = await fetch(`${B}/api/organization-context`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-clerk-user-id': workspaceContext.userId ?? '',
      ...(workspaceContext.email ? { 'x-clerk-user-email': workspaceContext.email } : {}),
      'x-org-id': workspaceContext.activeOrg.organizationId,
    },
    body: JSON.stringify({
      requestorEntityId,
      contextType,
      title: title ?? `Employment review — NPI ${npi}`,
      description: description ?? `Employer-initiated review for clinician NPI ${npi}.`,
      subjectEntityIds: [entityId],
    }),
  });

  if (!orgRes.ok) {
    const orgErr = await orgRes.json().catch(() => ({})) as { error?: string };
    return jsonError(
      {
        error: orgErr.error ?? 'Could not create review context.',
        hint: 'Employer must be registered as a VcvEntity. Contact VitalCV to set up an employer workspace.',
      },
      orgRes.status,
    );
  }

  const { context } = await orgRes.json() as { context: { id: string; status: string } };
  const origin = req.nextUrl.origin;
  const reviewUrl = `${origin}/review/${entityId}?contextId=${context.id}`;

  return NextResponse.json({
    contextId: context.id,
    entityId,
    status: context.status,
    reviewUrl,
    npi,
    displayName: passport.identity?.displayName ?? null,
  });
}
