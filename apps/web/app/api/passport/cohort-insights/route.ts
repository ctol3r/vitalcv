import { respondOk, sanitize } from '@/lib/api-envelope';

export const runtime = 'nodejs';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

/**
 * Cohort insights proxy for passport "Based on similar cases" surface.
 *
 * Combines two backend sources:
 *   /api/learning/ops       → acceptance rate, total applications (public)
 *   /api/internal/pilot/kpis → median days to start (internal; may fail)
 *
 * Honest degradation: missing signals return null. Caller must not fabricate.
 * All responses conform to the canonical envelope.
 */

interface LearningOpsResponse {
  overallMetrics?: {
    acceptCount?: number;
    applyCount?: number;
    rejectCount?: number;
    applyToAcceptRate?: number;
  };
}

interface PilotKpiResponse {
  velocity?: {
    medianDaysFirstReviewToStart?: number | null;
  };
}

interface CohortInsightsResult {
  cohortSize: number;
  acceptRate: number | null;
  avgStartDays: number | null;
}

export async function GET() {
  const [learning, pilot] = await Promise.all([
    safeFetch<LearningOpsResponse>(`${BACKEND_URL}/api/learning/ops`),
    safeFetch<PilotKpiResponse>(`${BACKEND_URL}/api/internal/pilot/kpis?days=90`),
  ]);

  const result: CohortInsightsResult = {
    cohortSize: learning?.overallMetrics?.applyCount ?? 0,
    acceptRate: learning?.overallMetrics?.applyToAcceptRate ?? null,
    avgStartDays: pilot?.velocity?.medianDaysFirstReviewToStart ?? null,
  };

  return respondOk(sanitize(result), 'Cohort insights computed');
}

async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    console.error('[cohort-insights] upstream fetch failed', { url, err: String(err) });
    return null;
  }
}
