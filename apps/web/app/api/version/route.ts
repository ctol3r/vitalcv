import { NextResponse } from 'next/server';
import { getVersionInfo } from '@/lib/deployInfo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/version — canonical build/version endpoint for release monitoring.
 *
 * Exposes the FULL commit SHA the running container was built from, so an
 * external monitor (the release-verify workflow) can assert that the deployed
 * web container is actually serving GitHub main HEAD — the ground-truth signal
 * that no other endpoint provided, which forced the P0 verification to proxy
 * "is the new code live?" with a route-presence check.
 *
 * Public: a commit SHA is not a secret (identical to the public GitHub commit).
 *
 * Distinct from /api/deploy-info on purpose:
 *   - /api/deploy-info is cached (s-maxage=60) and only exposes a 7-char sha,
 *     so right after a deploy it can still report the OLD sha.
 *   - a monitor MUST read the fresh full sha, so this route is `no-store`.
 *
 * SHA source: getVersionInfo() reads RAILWAY_GIT_COMMIT_SHA, which Railway
 * injects into the container at runtime (the same mechanism the backend already
 * uses for its /health git_sha).
 */
export function GET() {
  return NextResponse.json(getVersionInfo(), {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

export function HEAD() {
  return new Response(null, {
    status: 200,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
