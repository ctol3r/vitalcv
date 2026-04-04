/**
 * POST /api/request-review
 *
 * Proxy to POST /api/organization-context on the backend.
 * Creates a typed org context for an employer-initiated review.
 *
 * Body:
 *   {
 *     npi:           string,           // clinician NPI to review
 *     contextType?:  string,           // defaults to EMPLOYMENT_REVIEW
 *     title?:        string,
 *     description?:  string,
 *   }
 *
 * Response:
 *   {
 *     contextId:    string,            // UUID to embed in the review link
 *     reviewUrl:    string,            // /review/[entityId]?contextId=[contextId]
 *     entityId:     string,
 *     status:       string,
 *     npi:          string,
 *     displayName:  string | null,
 *   }
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  resolveEmployerWorkspaceRequestorContext,
} from '@/lib/server/employer-workspace';

export const runtime = 'nodejs';

import { BACKEND_URL as B } from '@/lib/backend-url';

const NPI_RE = /^\d{10}$/;

function jsonError(
  body: Record<string, unknown>,
  status: number,
) {
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
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

  // Resolve employer workspace — validates session, active org, and entity registration
  const workspaceCtx = await resolveEmployerWorkspaceRequestorContext();
  if (workspaceCtx.status === 'blocked') {
    const { status, ...body } = workspaceCtx.response;
    return jsonError(body, status);
  }

  const { userId, email, activeOrg, requestorEntityId } = workspaceCtx;

  // Resolve clinician passport
  const passportRes = await fetch(`${B}/api/passport/npi/${npi}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });

  if (!passportRes.ok) {
    if (passportRes.status === 404) {
      return jsonError(
        {
          code: 'CLINICIAN_PASSPORT_REQUIRED',
          error: 'No passport found for that NPI. The clinician must run a readiness check first.',
          hint: 'Ask the clinician to run a readiness check before creating an employer review context.',
          nextStep: 'run_clinician_readiness',
        },
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

  // Create organization context
  const orgHeaders = new Headers({
    'Content-Type': 'application/json',
    'x-clerk-user-id': userId,
    'x-org-id': activeOrg.organizationId,
  });
  if (email) {
    orgHeaders.set('x-clerk-user-email', email);
  }

  const orgRes = await fetch(`${B}/api/organization-context`, {
    method: 'POST',
    headers: orgHeaders,
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
