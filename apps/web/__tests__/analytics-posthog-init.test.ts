// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// AUD-4.1 guard: analytics must never initialize with an empty token. Calling
// posthog.init('') logged "PostHog was initialized without a token" and fired
// failed capture requests on every local/preview load. This suite pins the
// contract: init fires only with a real NEXT_PUBLIC_POSTHOG_KEY.

const initMock = vi.fn();
const captureUtmParams = vi.fn();

vi.mock('posthog-js', () => ({ default: { init: initMock } }));
vi.mock('posthog-js/react', () => ({
  PostHogProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/components/auth/RoleContext', () => ({
  RoleProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/analytics/funnel', () => ({ captureUtmParams }));

const ORIGINAL_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

describe('PostHog client initialization (AUD-4.1)', () => {
  beforeEach(() => {
    initMock.mockClear();
    captureUtmParams.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    else process.env.NEXT_PUBLIC_POSTHOG_KEY = ORIGINAL_KEY;
  });

  it('does not initialize PostHog when the key is absent', async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    await import('@/app/providers');
    expect(initMock).not.toHaveBeenCalled();
    // UTM attribution is vendor-independent and must still run.
    expect(captureUtmParams).toHaveBeenCalledTimes(1);
  });

  it('does not initialize PostHog when the key is an empty string', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = '';
    await import('@/app/providers');
    expect(initMock).not.toHaveBeenCalled();
  });

  it('initializes PostHog with the real token when the key is present', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_token';
    await import('@/app/providers');
    expect(initMock).toHaveBeenCalledTimes(1);
    expect(initMock.mock.calls[0]?.[0]).toBe('phc_test_token');
    expect(initMock).not.toHaveBeenCalledWith('', expect.anything());
  });
});
