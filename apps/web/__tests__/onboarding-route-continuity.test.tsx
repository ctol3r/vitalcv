import { describe, expect, it, vi } from 'vitest';

const redirectMock = vi.fn(() => {
  throw new Error('redirect');
});

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

describe('onboarding continuity routes', () => {
  it('routes /onboarding into the live intake flow and preserves returnTo', async () => {
    const { default: OnboardingPage } = await import('../app/onboarding/page');

    await expect(
      OnboardingPage({
        searchParams: Promise.resolve({
          returnTo: '/explore?apply=opp_1',
        }),
      }),
    ).rejects.toThrow('redirect');

    expect(redirectMock).toHaveBeenCalledWith(
      '/intake?returnTo=%2Fexplore%3Fapply%3Dopp_1',
    );
  });

  it('routes /get-ready into the live intake flow', async () => {
    const { default: GetReadyPage } = await import('../app/get-ready/page');

    await expect(
      GetReadyPage({
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('redirect');

    expect(redirectMock).toHaveBeenLastCalledWith('/intake');
  });
});
