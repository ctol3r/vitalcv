/**
 * POST /api/internal/agent/tick — the background agent loop's entry point.
 *
 * Machine-authenticated, not user-authenticated: this is called by a
 * scheduled caller (GitHub Actions cron), never by a browser. It reuses
 * `checkAuth` from the source-health probe rather than copying it — machine
 * auth duplicated is machine auth where one copy quietly isn't timing-safe.
 * Both env secrets unset ⇒ 500, not open.
 *
 * A2.1 is SHADOW ONLY. The tick plans and records; it executes nothing and
 * contacts nobody. That is a property of the code path (there is no executor
 * wired here), not a flag someone could flip by accident.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { checkAuth, readAuthEnv, readAuthHeaders } from '../../source-health/_auth';
import { runAgentTick, MAX_SUBJECTS_PER_TICK } from '@/lib/agent/schedule/tick';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Mirrors the probe's `?source=` labelling so operators can tell callers apart. */
const KNOWN_SOURCES = new Set(['cron', 'deploy', 'manual']);

export async function POST(request: NextRequest) {
  const auth = checkAuth(readAuthHeaders(request), readAuthEnv());
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const params = request.nextUrl.searchParams;
  const rawSource = params.get('source');
  const source = rawSource && KNOWN_SOURCES.has(rawSource) ? rawSource : 'manual';

  const rawLimit = params.get('limit');
  let limit: number | undefined;
  if (rawLimit !== null) {
    const parsed = Number(rawLimit);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return NextResponse.json({ error: 'limit must be a positive integer' }, { status: 400 });
    }
    // Clamped rather than rejected: an operator asking for more than the
    // ceiling gets the ceiling, because the ceiling is the safety property.
    limit = Math.min(MAX_SUBJECTS_PER_TICK, Math.floor(parsed));
  }

  // Explicit opt-in only. Outside production the tick defaults to dry-run, so
  // a stray call in a preview environment cannot consume schedule slots.
  const dryRun = params.get('dryRun') === 'true' ? true : params.get('dryRun') === 'false' ? false : undefined;

  try {
    const result = await runAgentTick({
      ...(limit !== undefined ? { limit } : {}),
      ...(dryRun !== undefined ? { dryRun } : {}),
    });
    return NextResponse.json({ source, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: 'tick failed', detail: error instanceof Error ? error.message : 'unknown' },
      { status: 500 },
    );
  }
}
