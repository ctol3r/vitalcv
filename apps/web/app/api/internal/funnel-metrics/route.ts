import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
const POSTHOG_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY || '';
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID || '';

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

export async function GET() {
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

    // Count each funnel event today
    const counts = await queryPostHog<EventCount>(
      `SELECT event, count() as count
       FROM events
       WHERE event IN (
         'homepage_viewed',
         'npi_input_focused',
         'npi_submitted',
         'results_displayed',
         'signup_prompt_shown',
         'signup_prompt_dismissed',
         'signup_clicked',
         'signup_completed',
         'packet_downloaded'
       )
       AND timestamp >= '${todayStr}'
       GROUP BY event`,
    );

    const countMap: Record<string, number> = {};
    for (const row of counts) {
      countMap[row.event] = row.count;
    }

    const views = countMap['homepage_viewed'] ?? 0;
    const focused = countMap['npi_input_focused'] ?? 0;
    const submitted = countMap['npi_submitted'] ?? 0;
    const displayed = countMap['results_displayed'] ?? 0;
    const promptShown = countMap['signup_prompt_shown'] ?? 0;
    const signupClicked = countMap['signup_clicked'] ?? 0;
    const signupCompleted = countMap['signup_completed'] ?? 0;
    const downloaded = countMap['packet_downloaded'] ?? 0;

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
        npi_focuses: focused,
        npi_submissions: submitted,
        results_displayed: displayed,
        signup_prompts_shown: promptShown,
        signup_clicks: signupClicked,
        signup_completions: signupCompleted,
        packet_downloads: downloaded,
        // Rates
        submission_rate: views > 0 ? submitted / views : null,
        result_success_rate: submitted > 0 ? displayed / submitted : null,
        signup_conversion_rate: displayed > 0 ? signupClicked / displayed : null,
        packet_download_rate: displayed > 0 ? downloaded / displayed : null,
        // Timing (seconds)
        avg_view_to_submit_seconds: avgViewToSubmitSeconds,
        avg_submit_to_result_seconds: avgSubmitToResultSeconds,
      },
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
