import { type NextRequest, NextResponse } from 'next/server';
import { recordPilotServerEvent } from '@/lib/server/pilot-ops';

export const runtime = 'nodejs';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeSingleSystemOutput(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value.length > 1) {
      throw new Error('Multiple system outputs detected');
    }
    return value[0] ?? null;
  }

  if (!isRecord(value)) {
    return value;
  }

  const multiOutputKeys = ['outputs', 'results', 'responses', 'decisions'] as const;
  for (const key of multiOutputKeys) {
    const candidate = value[key];
    if (!Array.isArray(candidate)) {
      continue;
    }

    if (candidate.length > 1) {
      throw new Error('Multiple system outputs detected');
    }

    if (candidate.length === 1) {
      return candidate[0] ?? null;
    }
  }

  return value;
}

function assertOmegaDecisionObject(payload: unknown): Record<string, unknown> {
  const candidate = normalizeSingleSystemOutput(payload);

  if (
    !isRecord(candidate)
    || (candidate.status !== 'ok' && candidate.status !== 'not_found' && candidate.status !== 'partial')
    || !isRecord(candidate.subject)
    || typeof candidate.subject.npi !== 'string'
    || !isRecord(candidate.context)
    || typeof candidate.context.persist !== 'boolean'
    || !Array.isArray(candidate.recent_actions)
    || typeof candidate.generatedAt !== 'string'
  ) {
    throw new TypeError('OmegaDecisionObject required');
  }

  return candidate;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  try {
    const response = await fetch(`${BACKEND_URL}/api/omega`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    const omega = assertOmegaDecisionObject(payload);

    if (response.status >= 500) {
      console.error('[api/omega] backend request failed', {
        status: response.status,
        hasNpi: typeof body.npi === 'string' && body.npi.length > 0,
      });
      void recordPilotServerEvent({
        eventType: 'route_failure',
        route: '/api/omega',
        severity: 'high',
        message: 'Omega backend request returned a server error.',
        details: {
          status: response.status,
          hasNpi: typeof body.npi === 'string' && body.npi.length > 0,
        },
        queueItem: {
          source: 'route_failure',
          title: 'Omega backend request failed',
          message: 'The omega proxy received a server error from the backend.',
          severity: 'high',
          blocking: false,
        },
      });
    }

    return NextResponse.json(omega, {
      status: response.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[api/omega] backend unavailable', {
      error: message,
      hasNpi: typeof body.npi === 'string' && body.npi.length > 0,
    });
    void recordPilotServerEvent({
      eventType: 'route_failure',
      route: '/api/omega',
      severity: 'high',
      message: 'Omega proxy request failed before a response was returned.',
      details: {
        error: message,
        hasNpi: typeof body.npi === 'string' && body.npi.length > 0,
      },
      queueItem: {
        source: 'route_failure',
        title: 'Omega proxy request failed',
        message: 'The omega proxy could not reach the backend service.',
        severity: 'high',
        blocking: false,
      },
    });
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}
