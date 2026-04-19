import { NextRequest, NextResponse } from 'next/server';
import { getBackendBase } from '@/lib/api';
import {
  PILOT_REQUEST_METRIC_NOTICE,
  PILOT_REQUEST_NEXT_STEP,
  PILOT_REQUEST_OWNER,
  PILOT_REQUEST_SUCCESS_CRITERIA,
} from '@/lib/pilot/pilotRequestContract';

const MONITORING_SECRET = process.env.MONITORING_SECRET?.trim() ?? '';

type PilotRequestInput = {
  organization: string | null;
  name: string | null;
  email: string | null;
  usecase: string | null;
  contentKind: 'json' | 'form';
};

function readTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

async function readPilotRequest(request: NextRequest): Promise<PilotRequestInput | null> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) {
      return null;
    }

    return {
      organization: readTrimmedString(body.organization),
      name: readTrimmedString(body.name),
      email: readTrimmedString(body.email),
      usecase: readTrimmedString(body.usecase),
      contentKind: 'json',
    };
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return null;
  }

  return {
    organization: readTrimmedString(form.get('organization')),
    name: readTrimmedString(form.get('name')),
    email: readTrimmedString(form.get('email')),
    usecase: readTrimmedString(form.get('usecase')),
    contentKind: 'form',
  };
}

function buildRedirectUrl(request: NextRequest, searchParams: Record<string, string>): URL {
  const url = new URL('/pilot', request.nextUrl.origin);
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return url;
}

/**
 * POST /api/pilot-request
 *
 * Accepts the public employer pilot request form, writes an attributable handoff
 * record into the pilot queue, and returns explicit owner / next-step guidance.
 */
export async function POST(request: NextRequest) {
  const body = await readPilotRequest(request);
  if (!body) {
    return NextResponse.json(
      { ok: false, message: 'Pilot request body is invalid.' },
      { status: 400 },
    );
  }

  // Basic validation
  const { organization, name, email, usecase, contentKind } = body;
  if (!organization || !name || !email) {
    if (contentKind === 'form') {
      return NextResponse.redirect(
        buildRedirectUrl(request, { requestError: 'missing_fields' }),
        { status: 303 },
      );
    }
    return NextResponse.json(
      { ok: false, message: 'Organization, name, and email are required.' },
      { status: 400 },
    );
  }

  if (!MONITORING_SECRET) {
    if (contentKind === 'form') {
      return NextResponse.redirect(
        buildRedirectUrl(request, { requestError: 'unavailable' }),
        { status: 303 },
      );
    }
    return NextResponse.json(
      { ok: false, message: 'Pilot intake is temporarily unavailable.' },
      { status: 503 },
    );
  }

  const queueResponse = await fetch(`${getBackendBase()}/api/internal/pilot-ops/queue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-monitoring-secret': MONITORING_SECRET,
      'x-clerk-user-email': email,
      'x-clerk-user-role': 'PILOT_REQUEST',
    },
    body: JSON.stringify({
      source: 'manual',
      title: `Pilot request — ${organization}`,
      message: `${name} requested a paid pilot handoff for ${organization}.`,
      route: '/pilot',
      owner: PILOT_REQUEST_OWNER,
      severity: 'medium',
      details: {
        organization,
        name,
        email,
        usecase,
        nextStep: PILOT_REQUEST_NEXT_STEP,
        metricNotice: PILOT_REQUEST_METRIC_NOTICE,
        successCriteria: [...PILOT_REQUEST_SUCCESS_CRITERIA],
      },
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);

  const queuePayload = queueResponse
    ? await queueResponse.json().catch(() => null) as { item?: { id?: string | null } } | null
    : null;

  if (!queueResponse?.ok || !queuePayload?.item?.id) {
    if (contentKind === 'form') {
      return NextResponse.redirect(
        buildRedirectUrl(request, { requestError: 'unavailable' }),
        { status: 303 },
      );
    }
    return NextResponse.json(
      { ok: false, message: 'Unable to record the pilot request right now.' },
      { status: 502 },
    );
  }

  if (contentKind === 'form') {
    return NextResponse.redirect(
      buildRedirectUrl(request, {
        requested: '1',
      }),
      { status: 303 },
    );
  }

  return NextResponse.json({
    ok: true,
    itemId: queuePayload.item.id,
    owner: PILOT_REQUEST_OWNER,
    nextStep: PILOT_REQUEST_NEXT_STEP,
    metricNotice: PILOT_REQUEST_METRIC_NOTICE,
    successCriteria: [...PILOT_REQUEST_SUCCESS_CRITERIA],
    message: 'Pilot request recorded and handed to Pilot Success.',
  });
}
