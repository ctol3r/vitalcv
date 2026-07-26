/**
 * ClerkProvider fallback-redirect guard.
 *
 * When a user reaches /sign-in or /sign-up directly (navbar "Sign In" carries
 * no ?redirect_url), Clerk relies on signInFallbackRedirectUrl /
 * signUpFallbackRedirectUrl to land them in /holder. Without them Clerk falls
 * back to homeUrl ("/") and a successful sign-in dumps the user on the
 * marketing homepage — the "sign-in doesn't work" regression that shipped when
 * the appearance prop was added (#629) and was fixed here.
 *
 * Source-level pin: a theming or layout refactor that drops these props fails
 * CI instead of production. Kept deliberately simple (grep the layout source)
 * so it survives ClerkProvider internals changing.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const layoutSource = readFileSync(
  join(process.cwd(), 'app', 'layout.tsx'),
  'utf8',
);

describe('ClerkProvider fallback redirects', () => {
  it('routes post-sign-in to /holder', () => {
    expect(layoutSource).toContain('signInFallbackRedirectUrl="/holder"');
  });

  it('routes post-sign-up to /holder', () => {
    expect(layoutSource).toContain('signUpFallbackRedirectUrl="/holder"');
  });

  it('still passes the wave1505 appearance (theming preserved)', () => {
    expect(layoutSource).toContain('appearance={clerkAppearance}');
  });
});
