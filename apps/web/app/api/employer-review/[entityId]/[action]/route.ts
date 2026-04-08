import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL as BACKEND } from '@/lib/backend-url';
import {
  normalizeEmployerAcceptanceHistoryResponse,
  normalizeEmployerReviewActionResponse,
  normalizeEmployerReviewStatusResponse,
} from '@/lib/employer-review-actions';
import { assertEmployerEvidencePacket } from '@/lib/trust/employer-packet-contract';

export const runtime = 'nodejs';

const AUTHENTICATED_MUTATION_ACTIONS = new Set([
  'accept',
  'request-refresh',
  'route-to-review',
  'confirm-start',
]);
const PUBLIC_MUTATION_ACTIONS = new Set(['view']);
const PUBLIC_READ_ACTIONS = new Set(['acceptance-history']);
const AUTHENTICATED_READ_ACTIONS = new Set(['packet', 'status']);

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNullableString(value: unknown): value is string | null | undefined {
  return typeof value === 'string' || value === null || typeof value === 'undefined';
}

function isNullableNumber(value: unknown): value is number | null | undefined {
  return value === null || typeof value === 'undefined' || (typeof value === 'number' && Number.isFinite(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function buildBackendActionUrl(
  req: NextRequest,
  entityId: string,
  action: string,
): string {
  return `${BACKEND}/api/employer-review/${encodeURIComponent(entityId)}/${action}${req.nextUrl.search}`;
}

function unauthorizedResponse() {
  return NextResponse.json(
    {
      error: 'unauthorized',
      error_description: 'Sign in with an employer workspace to continue.',
    },
    { status: 401 },
  );
}

function jsonError(
  status: number,
  error: string,
  errorDescription?: string,
) {
  return NextResponse.json(
    errorDescription ? { error, error_description: errorDescription } : { error },
    { status },
  );
}

function normalizeUpstreamError(
  status: number,
  payload: unknown,
  fallbackError: string,
  fallbackDescription: string,
) {
  if (isRecord(payload)) {
    const error = isString(payload.error) ? payload.error : fallbackError;
    const errorDescription = isString(payload.error_description)
      ? payload.error_description
      : isString(payload.detail)
        ? payload.detail
        : fallbackDescription;

    return jsonError(status, error, errorDescription);
  }

  return jsonError(status, fallbackError, fallbackDescription);
}

async function readJsonBody(req: NextRequest): Promise<unknown> {
  const raw = await req.text();
  if (!raw.trim()) {
    return {};
  }

  return JSON.parse(raw) as unknown;
}

function validateAllowedKeys(
  record: UnknownRecord,
  allowedKeys: readonly string[],
): string | null {
  const allowed = new Set(allowedKeys);
  const invalid = Object.keys(record).filter((key) => !allowed.has(key));
  return invalid.length > 0 ? invalid.join(', ') : null;
}

function parseAcceptBody(body: unknown): UnknownRecord | null {
  if (!isRecord(body)) {
    return null;
  }

  if (validateAllowedKeys(body, [
    'acceptanceScope',
    'acceptanceReason',
    'role',
    'facility',
    'notes',
    'organizationContextId',
    'bundleId',
  ])) {
    return null;
  }

  if (
    !(
      typeof body.acceptanceScope === 'undefined'
      || body.acceptanceScope === null
      || body.acceptanceScope === 'pilot'
      || body.acceptanceScope === 'full'
      || body.acceptanceScope === 'partial'
    )
    || !isNullableString(body.acceptanceReason)
    || !isNullableString(body.role)
    || !isNullableString(body.facility)
    || !isNullableString(body.notes)
    || !isNullableString(body.organizationContextId)
    || !isNullableString(body.bundleId)
  ) {
    return null;
  }

  return body;
}

function parseRefreshBody(body: unknown): UnknownRecord | null {
  if (!isRecord(body)) {
    return null;
  }

  if (validateAllowedKeys(body, [
    'staleSources',
    'missingDomains',
    'message',
    'organizationContextId',
    'bundleId',
  ])) {
    return null;
  }

  if (
    !(typeof body.staleSources === 'undefined' || body.staleSources === null || isStringArray(body.staleSources))
    || !(typeof body.missingDomains === 'undefined' || body.missingDomains === null || isStringArray(body.missingDomains))
    || !isNullableString(body.message)
    || !isNullableString(body.organizationContextId)
    || !isNullableString(body.bundleId)
  ) {
    return null;
  }

  return body;
}

function parseReviewBody(body: unknown): UnknownRecord | null {
  if (!isRecord(body)) {
    return null;
  }

  if (validateAllowedKeys(body, [
    'reason',
    'priority',
    'organizationContextId',
    'bundleId',
  ])) {
    return null;
  }

  if (
    !isNullableString(body.reason)
    || !(
      typeof body.priority === 'undefined'
      || body.priority === null
      || body.priority === 'LOW'
      || body.priority === 'NORMAL'
      || body.priority === 'HIGH'
    )
    || !isNullableString(body.organizationContextId)
    || !isNullableString(body.bundleId)
  ) {
    return null;
  }

  return body;
}

function parseConfirmStartBody(body: unknown): UnknownRecord | null {
  if (!isRecord(body)) {
    return null;
  }

  if (validateAllowedKeys(body, ['startedAt', 'role', 'facility', 'acceptanceId'])) {
    return null;
  }

  if (
    !isNullableString(body.startedAt)
    || !isNullableString(body.role)
    || !isNullableString(body.facility)
    || !isNullableString(body.acceptanceId)
  ) {
    return null;
  }

  return body;
}

function parseViewBody(body: unknown): UnknownRecord | null {
  if (!isRecord(body)) {
    return null;
  }

  if (validateAllowedKeys(body, ['organizationContextId', 'bundleId', 'readinessScore', 'blockers'])) {
    return null;
  }

  if (
    !isNullableString(body.organizationContextId)
    || !isNullableString(body.bundleId)
    || !isNullableNumber(body.readinessScore)
    || !(typeof body.blockers === 'undefined' || body.blockers === null || isStringArray(body.blockers))
  ) {
    return null;
  }

  return body;
}

function sanitizeActionBody(
  action: string,
  body: unknown,
): UnknownRecord | null {
  switch (action) {
    case 'accept':
      return parseAcceptBody(body);
    case 'request-refresh':
      return parseRefreshBody(body);
    case 'route-to-review':
      return parseReviewBody(body);
    case 'confirm-start':
      return parseConfirmStartBody(body);
    case 'view':
      return parseViewBody(body);
    default:
      return null;
  }
}

function expectedActionForMutation(
  action: string,
): 'accept' | 'refresh' | 'review' | null {
  switch (action) {
    case 'accept':
      return 'accept';
    case 'request-refresh':
      return 'refresh';
    case 'route-to-review':
      return 'review';
    default:
      return null;
  }
}

function isConfirmStartPayload(value: unknown): value is {
  ok: true;
  attestationId: string;
  auditEventId: string;
  startedAt: string;
} {
  return isRecord(value)
    && value.ok === true
    && isString(value.attestationId)
    && isString(value.auditEventId)
    && isString(value.startedAt);
}

function resolveProxyUrl(
  entityId: string,
  action: string,
  req: NextRequest,
): string {
  const search = 'nextUrl' in req && req.nextUrl
    ? req.nextUrl.search
    : new URL(req.url).search;
  return `${BACKEND}/api/employer-review/${encodeURIComponent(entityId)}/${action}${search}`;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ entityId: string; action: string }> },
) {
  const { entityId, action } = await context.params;

  if (!AUTHENTICATED_MUTATION_ACTIONS.has(action) && !PUBLIC_MUTATION_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Unsupported employer-review action.' }, { status: 404 });
  }

  const requiresAuth = AUTHENTICATED_MUTATION_ACTIONS.has(action);
  const { userId } = await auth();
  if (requiresAuth && !userId) {
    return unauthorizedResponse();
  }

  let parsedBody: unknown;
  try {
    parsedBody = await readJsonBody(req);
  } catch {
    return jsonError(400, 'invalid_request', 'Request body must be valid JSON.');
  }

  const sanitizedBody = sanitizeActionBody(action, parsedBody);
  if (!sanitizedBody) {
    return jsonError(400, 'invalid_request', `Malformed ${action} request body.`);
  }

  let response: Response;
  try {
    response = await fetch(resolveProxyUrl(entityId, action, req), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(userId ? { 'x-clerk-user-id': userId } : {}),
      },
      body: JSON.stringify(sanitizedBody),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    return jsonError(
      503,
      'backend_unavailable',
      error instanceof Error ? error.message : 'Employer review backend is unavailable.',
    );
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return normalizeUpstreamError(
      response.status,
      payload,
      'backend_action_failed',
      `Employer review action ${action} failed upstream.`,
    );
  }

  const expectedAction = expectedActionForMutation(action);
  if (expectedAction) {
    const normalized = normalizeEmployerReviewActionResponse(payload, expectedAction);
    if (!normalized) {
      return jsonError(502, 'invalid_upstream_payload', `Upstream ${action} response did not match the employer review action contract.`);
    }
    return NextResponse.json(normalized, { status: response.status });
  }

  if (action === 'confirm-start') {
    if (!isConfirmStartPayload(payload)) {
      return jsonError(502, 'invalid_upstream_payload', 'Upstream confirm-start response did not include attestation and audit event identifiers.');
    }
    return NextResponse.json(payload, { status: response.status });
  }

  return NextResponse.json(payload ?? {}, { status: response.status });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ entityId: string; action: string }> },
) {
  const { entityId, action } = await context.params;

  if (!PUBLIC_READ_ACTIONS.has(action) && !AUTHENTICATED_READ_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Unsupported employer-review action.' }, { status: 404 });
  }

  const requiresAuth = AUTHENTICATED_READ_ACTIONS.has(action);
  const { userId } = await auth();
  if (requiresAuth && !userId) {
    return unauthorizedResponse();
  }

  let response: Response;
  try {
    response = await fetch(resolveProxyUrl(entityId, action, req), {
      headers: {
        Accept: req.headers.get('accept') ?? 'application/json',
        ...(userId ? { 'x-clerk-user-id': userId } : {}),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    return jsonError(
      503,
      'backend_unavailable',
      error instanceof Error ? error.message : 'Employer review backend is unavailable.',
    );
  }

  const contentType = response.headers.get('content-type') ?? 'application/json';
  if (!contentType.includes('application/json')) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!response.ok) {
      return jsonError(response.status, 'backend_fetch_failed', `Employer review ${action} returned a non-JSON error response.`);
    }

    return new NextResponse(buffer, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': response.headers.get('content-disposition') ?? 'attachment; filename="vitalcv-employer-packet.json"',
        'Content-Length': String(buffer.length),
      },
    });
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return normalizeUpstreamError(
      response.status,
      payload,
      'backend_fetch_failed',
      `Employer review ${action} failed upstream.`,
    );
  }

  if (action === 'status') {
    const normalized = normalizeEmployerReviewStatusResponse(payload);
    if (!normalized) {
      return jsonError(502, 'invalid_upstream_payload', 'Upstream employer review status payload did not match the canonical contract.');
    }
    return NextResponse.json(normalized, { status: response.status });
  }

  if (action === 'acceptance-history') {
    const normalized = normalizeEmployerAcceptanceHistoryResponse(payload);
    if (!normalized) {
      return jsonError(502, 'invalid_upstream_payload', 'Upstream acceptance history payload did not match the canonical contract.');
    }
    return NextResponse.json(normalized, { status: response.status });
  }

  if (action === 'packet') {
    try {
      const packet = assertEmployerEvidencePacket(payload);
      return NextResponse.json(packet, { status: response.status });
    } catch (error) {
      return jsonError(
        502,
        'invalid_upstream_payload',
        error instanceof Error ? error.message : 'Upstream employer packet payload did not match the canonical contract.',
      );
    }
  }

  return NextResponse.json(payload ?? {}, { status: response.status });
}
