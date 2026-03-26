// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackUxEvent } from '@/lib/telemetry/ux-tracker';

describe('ux tracker', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    window.history.pushState({}, '', '/');
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1280,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    document.documentElement.classList.remove('dark');
  });

  it('logs safe development payloads with viewport and theme metadata', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390,
    });
    document.documentElement.classList.add('dark');
    window.history.pushState({}, '', '/interview');

    trackUxEvent({
      event_name: 'preview_visible',
      component_id: 'homepage_npi_flow',
      metadata: {
        source_mode: 'demo',
        nested: { blocked: true },
      },
    });

    expect(debugSpy).toHaveBeenCalledWith('[ux-tracker]', expect.objectContaining({
      event_name: 'preview_visible',
      component_id: 'homepage_npi_flow',
      route: '/interview',
      metadata: expect.objectContaining({
        source_mode: 'demo',
        theme: 'dark',
        viewport_bucket: 'mobile',
      }),
    }));

    const payload = debugSpy.mock.calls[0]?.[1] as { metadata: Record<string, unknown> } | undefined;
    expect(payload?.metadata).not.toHaveProperty('nested');
  });

  it('uses sendBeacon in production without blocking the UI', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(null));
    const sendBeaconMock = vi.fn(() => true);

    vi.stubEnv('NODE_ENV', 'production');
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1280,
    });
    Object.defineProperty(window.navigator, 'sendBeacon', {
      configurable: true,
      value: sendBeaconMock,
    });

    trackUxEvent({
      event_name: 'share_success',
      component_id: 'interview_share_packet',
      duration_ms: 18.6,
      metadata: {
        interaction_result: 'success',
      },
    });

    expect(debugSpy).not.toHaveBeenCalled();
    expect(sendBeaconMock).toHaveBeenCalledTimes(1);
    expect(sendBeaconMock).toHaveBeenCalledWith('/api/telemetry', expect.any(Blob));
    expect(fetchSpy).not.toHaveBeenCalled();

    const beaconBody = sendBeaconMock.mock.calls[0]?.[1] as Blob;
    const parsed = JSON.parse(await beaconBody.text()) as {
      duration_ms: number | null;
      metadata: Record<string, unknown>;
    };
    expect(parsed.duration_ms).toBe(19);
    expect(parsed.metadata).toMatchObject({
      interaction_result: 'success',
      viewport_bucket: 'desktop',
    });
  });
});
