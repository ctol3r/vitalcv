import { type NextRequest, NextResponse } from 'next/server';
import { getBackendBase } from '@/lib/api';

export const runtime = 'nodejs';

const MONITORING_SECRET = process.env.MONITORING_SECRET?.trim() ?? '';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readOptionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return normalized.length > 0 ? [...new Set(normalized)] : [];
}

function isValidIsoDateString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!MONITORING_SECRET) {
    return NextResponse.json({ error: 'MONITORING_SECRET not configured.' }, { status: 500 });
  }

  const payload = asRecord(await req.json().catch(() => null));
  if (!payload) {
    return NextResponse.json({ error: 'Request body must be a JSON object.' }, { status: 400 });
  }

  const entityId = readOptionalString(payload.entityId);
  if (!entityId || !UUID_RE.test(entityId)) {
    return NextResponse.json({ error: 'entityId must be a valid UUID.' }, { status: 400 });
  }

  const requestedStatus = readOptionalString(payload.status)?.toUpperCase();
  if (requestedStatus && requestedStatus !== 'STARTED' && requestedStatus !== 'DID_NOT_START') {
    return NextResponse.json({ error: 'status must be STARTED or DID_NOT_START.' }, { status: 400 });
  }

  const status = requestedStatus ?? 'STARTED';
  const nonStartReason = readOptionalString(payload.nonStartReason);
  const startedAt = payload.startedAt;

  if (status === 'STARTED' && !isValidIsoDateString(startedAt)) {
    return NextResponse.json({ error: 'startedAt must be a valid ISO date string.' }, { status: 400 });
  }

  if (status === 'DID_NOT_START' && !nonStartReason) {
    return NextResponse.json({ error: 'nonStartReason is required when status is DID_NOT_START.' }, { status: 400 });
  }

  const body: Record<string, unknown> = {
    entityId,
    status,
  };

  if (status === 'STARTED') {
    body.startedAt = startedAt;
  }

  const organizationContextId = readOptionalString(payload.organizationContextId);
  const pilotId = readOptionalString(payload.pilotId);
  const workflowLane = readOptionalString(payload.workflowLane);
  const geographyTag = readOptionalString(payload.geographyTag);
  const readinessScoreAtStart = readOptionalNumber(payload.readinessScoreAtStart);
  const blockers = readOptionalStringArray(payload.blockers);
  const note = readOptionalString(payload.note);
  const nonStartCategory = readOptionalString(payload.nonStartCategory);
  const recordedAt = readOptionalString(payload.recordedAt);

  if (organizationContextId) {
    body.organizationContextId = organizationContextId;
  }
  if (pilotId) {
    body.pilotId = pilotId;
  }
  if (workflowLane) {
    body.workflowLane = workflowLane;
  }
  if (geographyTag) {
    body.geographyTag = geographyTag;
  }
  if (typeof readinessScoreAtStart === 'number') {
    body.readinessScoreAtStart = readinessScoreAtStart;
  }
  if (blockers) {
    body.blockers = blockers;
  }
  if (note) {
    body.note = note;
  }
  if (status === 'DID_NOT_START' && nonStartReason) {
    body.nonStartReason = nonStartReason;
  }
  if (status === 'DID_NOT_START' && nonStartCategory) {
    body.nonStartCategory = nonStartCategory;
  }
  if (status === 'DID_NOT_START' && recordedAt) {
    if (!isValidIsoDateString(recordedAt)) {
      return NextResponse.json({ error: 'recordedAt must be a valid ISO date string.' }, { status: 400 });
    }
    body.recordedAt = recordedAt;
  }

  try {
    const upstream = await fetch(`${getBackendBase()}/api/internal/pilot/start-outcome`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-monitoring-secret': MONITORING_SECRET,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });

    const upstreamPayload = await upstream.json().catch(() => null) as Record<string, unknown> | null;

    if (!upstream.ok) {
      const error = typeof upstreamPayload?.error === 'string'
        ? upstreamPayload.error
        : 'Unable to record start outcome.';

      return NextResponse.json(
        { error },
        { status: upstream.status === 400 ? 400 : 500 },
      );
    }

    return NextResponse.json(
      upstreamPayload
      ?? {
        ok: true,
        entityId,
        status,
        ...(body.startedAt ? { startedAt: body.startedAt } : {}),
        ...(body.recordedAt ? { recordedAt: body.recordedAt } : {}),
        ...(body.nonStartReason ? { nonStartReason: body.nonStartReason } : {}),
      },
      { status: 202 },
    );
  } catch {
    return NextResponse.json({ error: 'Backend unreachable.' }, { status: 500 });
  }
}
