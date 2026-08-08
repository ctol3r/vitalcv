import { NextResponse } from 'next/server';
import { checkAuth, readAuthEnv, readAuthHeaders } from '../source-health/_auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
const POSTHOG_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY || '';
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID || '';

// The live acquisition funnel — see docs/ops/metrics-analytics.md. Since the
// /passport retirement (2026-08-07, #1096/#1099) the career loop on `/` emits
// npi_input_started at the moment the deleted hero console emitted
// npi_input_focused, and the guest lane on /onboarding owns the terminal pair
// (results_displayed / dropoff_detected).
const LIVE_FUNNEL_EVENTS = [
  'homepage_viewed',
  'npi_input_started',
  'npi_submitted',
  'results_displayed',
  'dropoff_detected',
] as const;

// Declared in FUNNEL_EVENTS but nothing live emits them. This endpoint reports
// today only, so counting a producer-less event would render a permanent 0 as
// if it were a measurement — they are labelled here instead of counted.
// Pre-retirement rows remain queryable in PostHog directly.
const RETIRED_FUNNEL_EVENTS = {
  npi_input_focused:
    'Producer (hero LiveTrustConsole) deleted 2026-08-07 with the /passport retirement (#1099); npi_input_started marks the equivalent moment.',
  signup_prompt_shown: 'Producer CreateAccountModal is no longer mounted anywhere.',
  signup_prompt_dismissed: 'Producer CreateAccountModal is no longer mounted anywhere.',
  signup_clicked: 'Producer CreateAccountModal is no longer mounted anywhere.',
  signup_completed: 'Never had a producer.',
  packet_downloaded:
    'Server producer exists on /api/passport/analytics/[npi]/download but nothing in the product calls that route since /passport retired.',
} as const;

interface EventCount {
  event: string;
  count: number;
}

interface EventTimingRow {
  avg_seconds: number;
}

async function queryPostHog<T>(query: string): Promise<T[]> {
  if (!POSTHOG_API_KEY || !POSTHOG_PROJECT_ID) {
    return [];
  }

  const res = await fetch(
    `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${POSTHOG_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown');
    throw new Error(`PostHog query failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const columns: string[] = data.columns ?? [];
  const rows: unknown[][] = data.results ?? [];

  return rows.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj as T;
  });
}

export async function GET(request: Request) {
  // Machine-authenticated: every query here is executed with
  // POSTHOG_PERSONAL_API_KEY, a privileged personal key, so an open route
  // would let anonymous callers drive it. Reuses the source-health probe's
  // checkAuth (same reasoning as agent/tick). Both env secrets unset ⇒ 500,
  // not open.
  const auth = checkAuth(readAuthHeaders(request), readAuthEnv());
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  if (!POSTHOG_API_KEY || !POSTHOG_PROJECT_ID) {
    return NextResponse.json(
      {
        error: 'Missing POSTHOG_PERSONAL_API_KEY or POSTHOG_PROJECT_ID env vars',
        metrics: null,
      },
      { status: 503 },
    );
  }

  try {
    const todayStr = new Date().toISOString().slice(0, 10);

    // Count each live funnel event today
    const counts = await queryPostHog<EventCount>(
      `SELECT event, count() as count
       FROM events
       WHERE event IN (
         ${LIVE_FUNNEL_EVENTS.map((e) => `'${e}'`).join(',\n         ')}
       )
       AND timestamp >= '${todayStr}'
       GROUP BY event`,
    );

    const countMap: Record<string, number> = {};
    for (const row of counts) {
      countMap[row.event] = row.count;
    }

    const views = countMap['homepage_viewed'] ?? 0;
    const started = countMap['npi_input_started'] ?? 0;
    const submitted = countMap['npi_submitted'] ?? 0;
    const displayed = countMap['results_displayed'] ?? 0;
    const dropoffs = countMap['dropoff_detected'] ?? 0;

    // Average time from page view → NPI submit (using funnel_timestamp property)
    const timingRows = await queryPostHog<EventTimingRow>(
      `SELECT avg(submit_ts - view_ts) / 1000 as avg_seconds
       FROM (
         SELECT
           distinct_id,
           min(if(event = 'homepage_viewed', properties.funnel_timestamp, NULL)) as view_ts,
           min(if(event = 'npi_submitted', properties.funnel_timestamp, NULL)) as submit_ts
         FROM events
         WHERE event IN ('homepage_viewed', 'npi_submitted')
         AND timestamp >= '${todayStr}'
         GROUP BY distinct_id
         HAVING view_ts IS NOT NULL AND submit_ts IS NOT NULL
       )`,
    );

    const avgViewToSubmitSeconds = timingRows[0]?.avg_seconds ?? null;

    // Average time from NPI submit → results displayed
    const resultTimingRows = await queryPostHog<EventTimingRow>(
      `SELECT avg(result_ts - submit_ts) / 1000 as avg_seconds
       FROM (
         SELECT
           distinct_id,
           min(if(event = 'npi_submitted', properties.funnel_timestamp, NULL)) as submit_ts,
           min(if(event = 'results_displayed', properties.funnel_timestamp, NULL)) as result_ts
         FROM events
         WHERE event IN ('npi_submitted', 'results_displayed')
         AND timestamp >= '${todayStr}'
         GROUP BY distinct_id
         HAVING submit_ts IS NOT NULL AND result_ts IS NOT NULL
       )`,
    );

    const avgSubmitToResultSeconds = resultTimingRows[0]?.avg_seconds ?? null;

    return NextResponse.json({
      date: todayStr,
      metrics: {
        homepage_views: views,
        npi_input_starts: started,
        npi_submissions: submitted,
        results_displayed: displayed,
        dropoffs_detected: dropoffs,
        // Rates
        submission_rate: views > 0 ? submitted / views : null,
        result_success_rate: submitted > 0 ? displayed / submitted : null,
        // Timing (seconds)
        avg_view_to_submit_seconds: avgViewToSubmitSeconds,
        avg_submit_to_result_seconds: avgSubmitToResultSeconds,
      },
      caveats: [
        'npi_submitted fires from both the homepage career loop (/) and the guest lane (/onboarding); results_displayed and dropoff_detected fire only from the guest lane, so result_success_rate undercounts guest-lane conversion.',
        'npi_input_started fires only from the homepage career loop — it is not an ancestor of guest-lane submissions.',
      ],
      retired_events: RETIRED_FUNNEL_EVENTS,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to query PostHog',
        detail: error instanceof Error ? error.message : String(error),
        metrics: null,
      },
      { status: 500 },
    );
  }
}
