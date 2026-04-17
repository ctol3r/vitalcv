'use client';

/**
 * /internal/funnel-debug — Conversion funnel metrics dashboard
 *
 * Fetches today's funnel data from the PostHog-backed API route and
 * displays conversion rates and timing at each step.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface FunnelMetrics {
  homepage_views: number;
  npi_focuses: number;
  npi_submissions: number;
  results_displayed: number;
  signup_prompts_shown: number;
  signup_clicks: number;
  signup_completions: number;
  packet_downloads: number;
  submission_rate: number | null;
  result_success_rate: number | null;
  signup_conversion_rate: number | null;
  packet_download_rate: number | null;
  avg_view_to_submit_seconds: number | null;
  avg_submit_to_result_seconds: number | null;
}

interface ApiResponse {
  date?: string;
  metrics: FunnelMetrics | null;
  error?: string;
}

function pct(rate: number | null): string {
  if (rate === null) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

function seconds(val: number | null): string {
  if (val === null) return '—';
  return `${val.toFixed(1)}s`;
}

export default function FunnelDebugPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/internal/funnel-metrics')
      .then((res) => res.json())
      .then((json: ApiResponse) => setData(json))
      .catch(() => setData({ metrics: null, error: 'Failed to fetch' }))
      .finally(() => setLoading(false));
  }, []);

  const m = data?.metrics;

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-16 text-foreground">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
          Internal
        </p>
        <h1 className="text-3xl font-semibold">Conversion Funnel</h1>
        {data?.date && (
          <p className="text-sm text-muted-foreground">Data for {data.date}</p>
        )}
      </header>

      {loading && (
        <p className="mt-10 text-muted-foreground">Loading funnel data…</p>
      )}

      {data?.error && (
        <div className="mt-10 rounded border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {data.error}
        </div>
      )}

      {m && (
        <>
          {/* Funnel steps */}
          <section className="mt-10">
            <h2 className="text-lg font-medium mb-4">Funnel Steps (Today)</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Homepage Views" value={m.homepage_views} />
              <MetricCard label="NPI Focused" value={m.npi_focuses} />
              <MetricCard label="NPI Submitted" value={m.npi_submissions} />
              <MetricCard label="Results Displayed" value={m.results_displayed} />
              <MetricCard label="Signup Prompt Shown" value={m.signup_prompts_shown} />
              <MetricCard label="Signup Clicked" value={m.signup_clicks} />
              <MetricCard label="Signup Completed" value={m.signup_completions} />
              <MetricCard label="Packet Downloaded" value={m.packet_downloads} />
            </div>
          </section>

          {/* Conversion rates */}
          <section className="mt-10">
            <h2 className="text-lg font-medium mb-4">Conversion Rates</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard
                label="NPI Submission Rate"
                value={pct(m.submission_rate)}
                subtitle="submissions / views"
              />
              <MetricCard
                label="Result Display Rate"
                value={pct(m.result_success_rate)}
                subtitle="results / submissions"
              />
              <MetricCard
                label="Signup Conversion Rate"
                value={pct(m.signup_conversion_rate)}
                subtitle="signups / results shown"
              />
              <MetricCard
                label="Packet Download Rate"
                value={pct(m.packet_download_rate)}
                subtitle="downloads / results shown"
              />
            </div>
          </section>

          {/* Timing */}
          <section className="mt-10">
            <h2 className="text-lg font-medium mb-4">Timing</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard
                label="Avg View → NPI Submit"
                value={seconds(m.avg_view_to_submit_seconds)}
              />
              <MetricCard
                label="Avg NPI Submit → Results"
                value={seconds(m.avg_submit_to_result_seconds)}
              />
            </div>
          </section>
        </>
      )}

      <p className="mt-10 text-sm text-muted-foreground">
        This page is read-only and is intended for operational monitoring.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        <Link href="/internal/metrics" className="underline underline-offset-4">
          Back to metrics
        </Link>
      </p>
    </main>
  );
}

function MetricCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <article className="rounded border border-border p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {subtitle && (
        <p className="mt-1 text-[10px] text-muted-foreground">{subtitle}</p>
      )}
    </article>
  );
}
