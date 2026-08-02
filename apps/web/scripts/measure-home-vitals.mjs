/**
 * Lab Web Vitals for the homepage, against a PRODUCTION build.
 *
 * Deliberately standalone rather than a Playwright spec: the e2e config's
 * webServer runs `dev:e2e` locally, and a dev build's timings are not a
 * measurement of anything shippable. This points at a `next start` server the
 * caller has already built.
 *
 * It also does not use the in-app browser pane. That pane loads tabs hidden,
 * and Chromium does not report a Largest Contentful Paint for a page that was
 * never visible — the first attempt returned `lcp: null` for exactly that
 * reason. This launches its own visible-by-default context.
 *
 * LAB, NOT FIELD. One machine, one cold-ish load, no CPU or network throttling
 * beyond what is passed in. These numbers are a regression signal and a
 * diagnostic. They are not the 75th-percentile field data that the Core Web
 * Vitals thresholds are defined against, and the report must not present them
 * as though they were.
 *
 *   node scripts/measure-home-vitals.mjs http://127.0.0.1:3461/ [runs]
 */
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://127.0.0.1:3461/';
const runs = Number(process.argv[3] ?? 5);

const collect = `() => new Promise((res) => {
  const out = { lcp: null, cls: 0, fcp: null, ttfb: null, domInteractive: null, load: null, shifts: 0 };
  try {
    new PerformanceObserver((l) => {
      const e = l.getEntries();
      if (e.length) out.lcp = Math.round(e[e.length - 1].startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((l) => {
      for (const en of l.getEntries()) {
        if (!en.hadRecentInput) { out.cls += en.value; out.shifts++; }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {}
  setTimeout(() => {
    const p = performance.getEntriesByType('paint').find((x) => x.name === 'first-contentful-paint');
    if (p) out.fcp = Math.round(p.startTime);
    const n = performance.getEntriesByType('navigation')[0];
    if (n) {
      out.ttfb = Math.round(n.responseStart);
      out.domInteractive = Math.round(n.domInteractive);
      out.load = Math.round(n.loadEventEnd);
    }
    out.cls = Number(out.cls.toFixed(4));
    res(out);
  }, 3000);
})`;

const browser = await chromium.launch();
const rows = [];

for (let i = 0; i < runs; i++) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load' });
  // Keep the page foregrounded; a hidden page reports no LCP.
  await page.bringToFront();
  // Invoked, not just named: `evaluate` treats a bare string as an EXPRESSION,
  // so passing `collect` alone returns the function instead of its result.
  rows.push(await page.evaluate(`(${collect})()`));
  await ctx.close();
}

await browser.close();

const med = (k) => {
  const v = rows.map((r) => r[k]).filter((x) => typeof x === 'number').sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : null;
};

console.log(JSON.stringify({
  url,
  runs,
  raw: rows,
  median: { lcp: med('lcp'), cls: med('cls'), fcp: med('fcp'), ttfb: med('ttfb'), domInteractive: med('domInteractive'), load: med('load') },
}, null, 2));
