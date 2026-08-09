/**
 * The /ops sign-in redirect, exercised at the page level.
 *
 * Finding F10 of the 2026-08-09 page consistency audit: these three pages sit
 * outside the middleware matcher and gate themselves, and had drifted into
 * three different shapes. Measured against production at commit `e93809aa`:
 *
 *     /ops               → /sign-in?redirect_url=/ops              (unencoded)
 *     /ops/engine        → /sign-in?redirect_url=/ops/engine       (unencoded)
 *     /ops/survivability → /sign-in                                (target LOST)
 *
 * PR #1239 converged all three on `signInRedirectTo()` and verified them with
 * live anonymous checks. This adds the regression cover that has to keep
 * holding afterwards, at the level the defect actually lived: not "does the
 * helper format a string" (it has its own unit), and not a grep for the
 * import — but *what a signed-out visitor to each page is handed*.
 *
 * It also covers a case that is awkward to check live: `/ops/survivability`
 * lost its destination silently. A live check confirms the redirect happens;
 * only an assertion on the target catches it coming back.
 *
 * Note for anyone extending this: `auth()` throws without Clerk middleware, so
 * these pages cannot be exercised end-to-end in a keyless local build — all
 * three 500 before reaching the redirect. Hence the mock rather than a request.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();
const redirectMock = vi.fn((url: string) => {
  // Next's redirect() never returns — it throws a control-flow signal. Model
  // that, or the page body keeps executing past the auth gate and the test
  // measures the wrong thing.
  const err = new Error(`NEXT_REDIRECT:${url}`);
  (err as Error & { digest?: string }).digest = `NEXT_REDIRECT;replace;${url};307;`;
  throw err;
});

// /ops/engine's module tree reaches a `server-only` import, which throws under
// the test environment. Same neutralization the other server-module suites use.
vi.mock('server-only', () => ({}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
  currentUser: vi.fn().mockResolvedValue(null),
}));

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return { ...actual, redirect: redirectMock, notFound: vi.fn() };
});

const CASES = [
  ['/ops', '../app/ops/page.tsx', '/sign-in?redirect_url=%2Fops'],
  ['/ops/engine', '../app/ops/engine/page.tsx', '/sign-in?redirect_url=%2Fops%2Fengine'],
  [
    '/ops/survivability',
    '../app/ops/survivability/page.tsx',
    '/sign-in?redirect_url=%2Fops%2Fsurvivability',
  ],
] as const;

describe('/ops · a signed-out visitor is returned to where they were going', () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    redirectMock.mockClear();
  });

  it.each(CASES)('%s hands back %s', async (_route, modulePath, expected) => {
    authMock.mockResolvedValue({ userId: null });

    const mod = await import(new URL(modulePath, import.meta.url).href);
    await expect(mod.default({})).rejects.toThrow(/NEXT_REDIRECT/);

    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith(expected);
  });

  it.each(CASES)('%s keeps a usable return destination', async (route, modulePath) => {
    authMock.mockResolvedValue({ userId: null });

    const mod = await import(new URL(modulePath, import.meta.url).href);
    await expect(mod.default({})).rejects.toThrow(/NEXT_REDIRECT/);

    const url = redirectMock.mock.calls[0]?.[0] as string;
    const target = new URLSearchParams(url.split('?')[1]).get('redirect_url');
    // The regression was a BARE /sign-in — the parameter absent entirely.
    expect(target).toBe(route);
    // ...and the pre-fix shape leaked an unencoded path into the query string.
    expect(url).not.toMatch(/redirect_url=\/[a-z]/);
  });
});
