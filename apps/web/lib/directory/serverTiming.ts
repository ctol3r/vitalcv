/**
 * serverTiming.ts — render-phase span timing for /directory/[npi].
 *
 * WHY THIS EXISTS
 * ---------------
 * The directory page's cold render was measured at 8.22–8.30s in production
 * while its ISR-warm serves are 0.15–0.53s and every other surface is
 * 0.12–0.23s. Upstream latency was disproven by direct measurement (NPPES
 * ~0.20s, the exact CMS query 0.26–0.47s), so the cost lives somewhere inside
 * the render — and nothing measured where. This module is that measurement.
 *
 * WHERE THE SPANS SURFACE — AND WHY NOT A RESPONSE HEADER
 * -------------------------------------------------------
 * The spans are formatted as a standard `Server-Timing` field value
 * (`nppes;dur=203.1, cms;dur=310.4, …`), but they are NOT emitted as an HTTP
 * header, for two reasons that are facts of the platform rather than choices:
 *
 *   1. An App Router server-component page has no API that can set a response
 *      header — `headers()` is read-only, middleware completes before the
 *      render starts, and `after()` runs when the response is already gone.
 *   2. The page is ISR (`revalidate = 3600`). A header describes the response
 *      it rides on, and for every cache-served request that would be a
 *      previous render's measurement presented as this request's — a
 *      projection dressed as a measurement.
 *
 * So the spans ride in the rendered document instead — an inert
 * `<script type="application/server-timing">` in the body and a
 * `server-timing-metadata` meta tag for the metadata phase — where they
 * describe exactly the render that produced that HTML, survive the ISR cache
 * with the correct meaning, and cost nothing to streaming. DevTools will not
 * chart them; `curl | grep` is the intended consumer.
 *
 * The structured log line (`DIRECTORY_TIMING=1`) is the second consumer, for
 * production log tailing. The `npiHash` in it is a correlation key, NOT an
 * anonymization: a SHA-256 of a ten-digit number is brute-forceable in
 * seconds (see components/directory/RecordAnalytics.tsx for the rule this
 * follows). It adds no exposure — the raw NPI is already in the request path
 * of the same process's access logs — and exists so log lines for one NPI can
 * be grouped without pasting NPIs into queries.
 */

import { createHash } from 'node:crypto';

export interface TimingSpan {
  name: string;
  /** Duration in milliseconds, 0.1ms resolution. */
  durMs: number;
}

export type DirectoryRenderPhase = 'metadata' | 'page';

export class DirectoryTiming {
  private readonly spans: TimingSpan[] = [];
  private readonly startedAt = performance.now();

  constructor(
    private readonly phase: DirectoryRenderPhase,
    private readonly npi: string,
  ) {}

  /**
   * Measure one awaited step. Records the span whether the step resolves or
   * throws — a failing upstream is precisely the kind of time worth seeing.
   */
  async measure<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
    const t0 = performance.now();
    try {
      return await fn();
    } finally {
      this.spans.push({ name, durMs: round1(performance.now() - t0) });
    }
  }

  /** Measure one synchronous step. */
  measureSync<T>(name: string, fn: () => T): T {
    const t0 = performance.now();
    try {
      return fn();
    } finally {
      this.spans.push({ name, durMs: round1(performance.now() - t0) });
    }
  }

  /** The spans recorded so far, in execution order. */
  getSpans(): readonly TimingSpan[] {
    return this.spans;
  }

  /**
   * Standard Server-Timing field-value syntax (RFC 8941 style):
   * `nppes;dur=203.1, cms;dur=310.4`. Span names are internal constants;
   * nothing caller-supplied reaches this string.
   */
  headerValue(): string {
    return this.spans.map((s) => `${s.name};dur=${s.durMs}`).join(', ');
  }

  /**
   * One structured line to stdout, gated behind DIRECTORY_TIMING=1 so the
   * instrument is silent unless someone is actually looking. Interpretation
   * key for the duplication question: a span of a few ms means Next served
   * the fetch from its data cache or request memoization; tens to hundreds
   * of ms means the request actually went upstream.
   */
  log(): void {
    if (process.env.DIRECTORY_TIMING !== '1') return;
    const line = {
      event: 'directory_timing',
      route: '/directory/[npi]',
      phase: this.phase,
      npiHash: createHash('sha256').update(this.npi).digest('hex').slice(0, 12),
      spans: Object.fromEntries(this.spans.map((s) => [s.name, s.durMs])),
      totalMs: round1(performance.now() - this.startedAt),
    };
    console.log(JSON.stringify(line));
  }
}

function round1(ms: number): number {
  return Math.round(ms * 10) / 10;
}
