export type UxTrackerMetadataValue = string | number | boolean | null;

export interface UxTrackerEvent {
  event_name: string;
  duration_ms: number | null;
  component_id: string;
  route: string;
  metadata: Record<string, UxTrackerMetadataValue>;
}

function viewportBucket(): string {
  if (typeof window === 'undefined') return 'unknown';
  const width = window.innerWidth;
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

function themeLabel(): string {
  if (typeof document === 'undefined') return 'unknown';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function normalizeMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, UxTrackerMetadataValue> {
  const entries = Object.entries(metadata ?? {}).filter(([, value]) => (
    value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ));

  return Object.fromEntries(entries) as Record<string, UxTrackerMetadataValue>;
}

export function trackUxEvent(input: {
  event_name: string;
  component_id: string;
  duration_ms?: number | null;
  route?: string;
  metadata?: Record<string, unknown>;
}): void {
  if (typeof window === 'undefined') return;

  try {
    const payload: UxTrackerEvent = {
      event_name: input.event_name,
      duration_ms: typeof input.duration_ms === 'number'
        ? Math.max(0, Math.round(input.duration_ms))
        : null,
      component_id: input.component_id,
      route: input.route ?? window.location.pathname,
      metadata: {
        viewport_bucket: viewportBucket(),
        theme: themeLabel(),
        ...normalizeMetadata(input.metadata),
      },
    };

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[ux-tracker]', payload);
      return;
    }

    const body = JSON.stringify(payload);

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon('/api/telemetry', blob)) {
        return;
      }
    }

    void fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Telemetry must never interrupt the UI.
  }
}
