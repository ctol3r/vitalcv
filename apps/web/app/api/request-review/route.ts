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
 *     contextId:  string,              // UUID to embed in the review link
 *     reviewUrl:  string,              // /review/[entityId]?contextId=[contextId]
 *     entityId:   string,
 *     status:     string,
 *   }
 */
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: 'Sign in with an employer workspace to request a review.' },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || !body.npi) {
    return NextResponse.json(
      { error: 'npi is required.' },
      { status: 400 },
    );
  }

  const { npi, contextType = 'EMPLOYMENT_REVIEW', title, description } = body as {
    npi: string;
    contextType?: string;
    title?: string;
    description?: string;
  };

  if (!/^\d{10}$/.test(npi)) {
    return NextResponse.json({ error: 'npi must be a 10-digit number.' }, { status: 400 });
  }

  // Step 1: Resolve the NPI to an entity ID
  const passportRes = await fetch(`${B}/api/passport/npi/${npi}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!passportRes.ok) {
    if (passportRes.status === 404) {
      return NextResponse.json(
        { error: 'No passport found for that NPI. The clinician must run a readiness check first.' },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: 'Could not resolve passport for that NPI.' },
      { status: passportRes.status },
    );
  }

  const passport = await passportRes.json() as { entityId: string; identity?: { displayName?: string } };
  const entityId = passport.entityId;
  if (!entityId) {
    return NextResponse.json(
      { error: 'Passport record found but entity ID is missing.' },
      { status: 500 },
    );
  }

  // Step 2: Create the org context
  const orgRes = await fetch(`${B}/api/organization-context`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-clerk-user-id': userId,
    },
    body: JSON.stringify({
      requestorEntityId: userId,   // employer's Clerk user ID (backend maps to entity if registered)
      contextType,
      title: title ?? `Employment review — NPI ${npi}`,
      description: description ?? `Employer-initiated review for clinician NPI ${npi}.`,
      subjectEntityIds: [entityId],
    }),
  });

  // If the requestor isn't registered as a VcvEntity, fall back to a direct context stub
  // that still lets the review flow work with the share/review infrastructure.
  if (!orgRes.ok) {
    const orgErr = await orgRes.json().catch(() => ({})) as { error?: string };

    // If it's a foreign-key error (requestorEntityId not in vcv_entities), we note this clearly.
    const errMsg = orgErr.error ?? 'Could not create review context.';
    return NextResponse.json(
      {
        error: errMsg,
        hint: 'Employer must be registered as a VcvEntity. Contact VitalCV to set up an employer workspace.',
      },
      { status: orgRes.status },
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
