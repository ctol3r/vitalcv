import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type MetadataValue = string | number | boolean | null;

interface TelemetryEvent {
  event_name: string;
  duration_ms: number | null;
  component_id: string;
  route: string;
  metadata: Record<string, MetadataValue>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readMetadata(metadata: unknown): Record<string, MetadataValue> {
  if (!isRecord(metadata)) return {};

  const entries = Object.entries(metadata).filter(([, value]) => (
    value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ));

  return Object.fromEntries(entries) as Record<string, MetadataValue>;
}

function normalizeEvent(value: unknown): TelemetryEvent | null {
  if (!isRecord(value)) return null;

  const eventName = typeof value.event_name === 'string' ? value.event_name.trim() : '';
  const componentId = typeof value.component_id === 'string' ? value.component_id.trim() : '';
  const route = typeof value.route === 'string' ? value.route.trim() : '';

  if (!eventName || !componentId || !route) {
    return null;
  }

  return {
    event_name: eventName,
    duration_ms: typeof value.duration_ms === 'number' ? Math.max(0, Math.round(value.duration_ms)) : null,
    component_id: componentId,
    route,
    metadata: readMetadata(value.metadata),
  };
}

export async function POST(req: NextRequest) {
  let body: unknown = null;

  try {
    body = await req.json();
  } catch (error) {
    console.error('[ux-telemetry] invalid json payload', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ accepted: 0 }, { status: 400 });
  }

  const candidates = Array.isArray(body)
    ? body
    : isRecord(body) && Array.isArray(body.events)
      ? body.events
      : [body];
  const events = (candidates as unknown[])
    .map(normalizeEvent)
    .filter((event: TelemetryEvent | null): event is TelemetryEvent => Boolean(event));

  if (events.length === 0) {
    console.warn('[ux-telemetry] rejected empty or invalid payload');
    return NextResponse.json({ accepted: 0 }, { status: 400 });
  }

  for (const event of events) {
    console.info('[ux-telemetry]', JSON.stringify(event));
  }

  return NextResponse.json({ accepted: events.length }, { status: 202 });
}
