/**
 * GET /api/receipt/by-lineage/:lineageKey
 *
 * Receipt retrieval keyed by `lineageKey` rather than NPI. Mirrors the
 * shape of the NPI-keyed handler at `apps/web/app/api/receipt/[npi]/`
 * but accepts the institutional-identity claim a verifier already has
 * (the lineageKey) as the path parameter.
 *
 * Path note: this route lives under `/by-lineage/` because Next.js
 * cannot have two different dynamic-slug names at the same path level.
 * The sister NPI route is `/api/receipt/[npi]`; both share the same
 * downstream signing path.
 *
 * Why a separate route: a verifier holding a signed receipt has the
 * `lineageKey` in the JWT's `vcv.replay.lineageKey` claim. They can
 * use this endpoint to re-fetch a fresh receipt for the same subject
 * without needing to know the NPI behind the lineage — but ONLY if
 * they ALSO supply the NPI as a query param so the route can verify
 * the claim: `computeLineageKey(npi) === path.lineageKey`.
 *
 * The cross-check prevents callers from probing arbitrary lineageKeys
 * without proof of the underlying subject; it also makes the route's
 * semantics symmetric with the NPI handler — both require the NPI to
 * actually issue.
 *
 * Why not a backend-side lineageKey → NPI lookup: that would require
 * a persistent index that doesn't exist on the current schema.
 * Adding it is a separate piece of work; this handler ships the
 * convenience surface today using a verifier-supplied claim instead.
 *
 *   200 — receipt issued (proxies to the NPI handler)
 *   400 — missing or malformed `?npi=`
 *   401 — `computeLineageKey(npi) !== path.lineageKey` (claim rejected)
 *   404 — passport not available for this NPI
 *   501 — no `?npi=` supplied AND no backend lookup index available
 *
 * Response is the same `application/jwt` body as the NPI handler.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { GET as receiptByNpi } from '../../[npi]/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LINEAGE_PREFIX = 'lin_v1_';

function isV1LineageKey(value: string): boolean {
  return value.startsWith(LINEAGE_PREFIX) && value.length === LINEAGE_PREFIX.length + 16;
}

/**
 * Server-side recomputation of `computeLineageKey(npi)`. We MUST use
 * the same algorithm the backend canonical (`apps/api/backend/src/services/
 * replay/replayIdentity.ts`, PR #343) uses; this is a small inline mirror
 * because importing the backend module into this web route would cross
 * an app boundary unnecessarily for one hash. The contract doc
 * (`docs/contracts/replay-identity-contract.md`, PR #353) pins both
 * implementations to byte-identical output.
 */
function computeLineageKeyFromNpi(npi: string): string {
  const canonical = npi.trim().toLowerCase();
  const digest = createHash('sha256').update(`entity|${canonical}`).digest('hex');
  return `${LINEAGE_PREFIX}${digest.slice(0, 16)}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ lineageKey: string }> },
) {
  const { lineageKey } = await params;

  if (!isV1LineageKey(lineageKey)) {
    return NextResponse.json(
      {
        error: 'invalid_lineage_key',
        detail: 'Path parameter must be a v1 lineage key (lin_v1_<16 hex chars>).',
      },
      { status: 400 },
    );
  }

  const url = new URL(req.url);
  const npi = url.searchParams.get('npi')?.trim() ?? '';

  if (!npi) {
    return NextResponse.json(
      {
        error: 'npi_query_required',
        detail:
          'Receipt retrieval by lineageKey requires the NPI as a verifier-supplied claim '
          + '(?npi=<10-digit-npi>). The route will verify computeLineageKey(npi) matches '
          + 'the path lineageKey before issuing. A backend-side lineageKey→NPI lookup '
          + 'index is not currently available.',
        alternative_path: '/api/receipt/<npi>',
      },
      { status: 501 },
    );
  }

  if (!/^\d{10}$/.test(npi)) {
    return NextResponse.json(
      { error: 'invalid_npi', detail: 'NPI must be a 10-digit string.' },
      { status: 400 },
    );
  }

  const expectedLineageKey = computeLineageKeyFromNpi(npi);
  if (expectedLineageKey !== lineageKey) {
    return NextResponse.json(
      {
        error: 'lineage_mismatch',
        detail: 'The supplied NPI does not match the path lineageKey.',
        path_lineageKey: lineageKey,
        expected_lineageKey: expectedLineageKey,
      },
      { status: 401 },
    );
  }

  // Delegate to the NPI handler — same JWT signing path, same caching
  // headers, same deterministic jti.
  return receiptByNpi(req, { params: Promise.resolve({ npi }) });
}
