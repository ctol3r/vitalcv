import { respondOk, sanitize } from '@/lib/api-envelope';
import { fetchLaunchOpportunities } from '@/lib/launch/marketplace';

export const runtime = 'nodejs';

/**
 * Returns a single "closest to" opportunity for the passport Autopilot surface.
 * Currently: first public opportunity from the launch marketplace.
 * TODO: replace with fit-ranking once matching service is wired.
 *
 * Envelope shape: { result: { employer, role } | null, blockers, explanation, timestamp }
 */

interface TopMatchResult {
  employer: string;
  role: string;
  organizationSlug: string;
}

export async function GET() {
  try {
    const payload = await fetchLaunchOpportunities({ limit: 1 });
    const top = payload?.opportunities?.[0] ?? null;
    if (!top) {
      return respondOk<TopMatchResult | null>(null, 'No public opportunity available');
    }
    const result: TopMatchResult = {
      employer: top.organizationName,
      role: top.title,
      organizationSlug: top.organizationSlug,
    };
    return respondOk(sanitize(result));
  } catch (err) {
    console.error('[passport/top-match] fetch failed', err);
    return respondOk<TopMatchResult | null>(null, 'Top match unavailable');
  }
}
