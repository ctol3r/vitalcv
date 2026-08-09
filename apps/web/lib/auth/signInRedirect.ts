/**
 * Build a /sign-in URL that returns the visitor to where they were going.
 *
 * `middleware.ts` already does this correctly for the ~53 routes it gates
 * (`searchParams.set('redirect_url', pathname)`, which percent-encodes). The
 * three /ops pages gate themselves in the page body instead, and had drifted
 * into three different shapes — recorded as finding F10 of the 2026-08-09 page
 * audit:
 *
 *   /ops               → '/sign-in?redirect_url=/ops'            unencoded
 *   /ops/engine        → '/sign-in?redirect_url=/ops/engine'      unencoded
 *   /ops/survivability → '/sign-in'                               destination LOST
 *
 * A signed-out visitor to the third signed in and did not arrive where they
 * were going. This is the one shape, encoded the same way the middleware
 * encodes it.
 *
 * Not an authorization change: the gate still fires identically and this
 * helper decides nothing about access. It only formats the return address.
 */
export function signInRedirectTo(pathname: string): string {
  const params = new URLSearchParams({ redirect_url: pathname });
  return `/sign-in?${params.toString()}`;
}
