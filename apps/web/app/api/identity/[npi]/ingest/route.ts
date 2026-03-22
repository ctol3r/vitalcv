/**
 * POST /api/identity/[npi]/ingest
 *
 * Proxy to backend POST /api/identity/:npi/ingest.
 * Triggers real multi-source ingestion: NPPES_API + OIG_LEIE.
 * Returns FullIngestionReport with per-source results, artifact IDs, claim counts.
 *
 * Sources called:
 *   NPPES_API — CMS National Plan & Provider Enumeration System (real HTTP, always)
 *   OIG_LEIE  — HHS Office of Inspector General exclusion list (real when OIG_LEIE_ENABLED=true)
 *
 * Both complete in parallel; either may fail independently without aborting the other.
 * Status 200 = all sources succeeded.
 * Status 207 = partial success or critical delta detected.
 * Status 500 = pipeline error.
 */

import type { NextRequest } from 'next/server';
import { NextResponse }     from 'next/server';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL              ||
  process.env.NEXT_PUBLIC_API_BASE     ||
  process.env.NEXT_PUBLIC_BACKEND_URL  ||
  'http://localhost:4000';

const NPI_RE = /^\d{10}$/;

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ npi: string }> },
) {
  const { npi } = await context.params;

  if (!NPI_RE.test(npi)) {
    return NextResponse.json({ error: 'Invalid NPI — must be 10 digits' }, { status: 400 });
  }

  try {
    const upstream = await fetch(
      `${BACKEND}/api/identity/${encodeURIComponent(npi)}/ingest`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        // Only run the two fast authoritative sources for the homepage flow.
        // Slower sources (PUBMED, OPENALEX, STATE_BOARD) run separately via the
        // full ingest or background monitor.
        body:    JSON.stringify({ sources: ['NPPES_API', 'OIG_LEIE'] }),
        signal:  AbortSignal.timeout(12_000),
      },
    );

    const data = await upstream.json().catch(() => ({
      error: `Upstream returned ${upstream.status} with non-JSON body`,
    }));

    return NextResponse.json(data, { status: upstream.status });

  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError';
    return NextResponse.json(
      {
        error:   isTimeout ? 'Ingest timed out — backend may be starting up' : 'Backend unavailable',
        detail:  String(err),
        fallback: true,
      },
      { status: 503 },
    );
  }
}
