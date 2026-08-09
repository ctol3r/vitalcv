/**
 * Asset-integrity gate — run this BEFORE any visual capture.
 *
 * WHY THIS EXISTS. During D-01A verification a concurrent build rewrote
 * `.next/` underneath a running `next start`. The server kept serving HTML
 * that referenced `c4745a27113213f1.css`; that file no longer existed, so the
 * homepage stylesheet 400'd and every `.ezh-*` element rendered at browser
 * defaults. The screenshots looked plausible, `getComputedStyle` reported
 * `border-radius: 0px`, and the harness recorded CLS 0 at every width — a
 * clean-looking result that was measuring an unstyled page. Nothing in the
 * capture path noticed.
 *
 * `next start` serves the build it BOOTED with. A rebuild under it does not
 * hot-swap; it invalidates it. This gate makes that failure loud:
 *
 *   1. every <link rel=stylesheet> and <script src> resolves 200 with a
 *      sane content-type (an HTML body for a .css URL is the tell),
 *   2. the served BUILD_ID matches `.next/BUILD_ID` on disk,
 *   3. a sentinel rule that MUST be present actually is.
 *
 *   BASE=http://localhost:4319 node scripts/design-evidence/verify-assets.mjs
 *
 * Exits non-zero on any failure so a capture run can be chained behind it:
 *   node .../verify-assets.mjs && node .../capture-vitals.mjs
 */
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:4319';
const ROUTE = process.env.ROUTE || '/';
// A rule that proves the homepage island's stylesheet is really being served.
const SENTINEL = process.env.SENTINEL || 'ezh-npi-submit';

const fail = [];
const ok = [];

const res = await fetch(BASE + ROUTE);
if (!res.ok) {
  console.error(`FAIL  ${ROUTE} -> HTTP ${res.status}`);
  process.exit(1);
}
const html = await res.text();

// 1. served build id vs the build on disk
const served = html.match(/"buildId":"([^"]+)"/)?.[1]
  ?? html.match(/\/_next\/static\/([A-Za-z0-9_-]{8,})\/_buildManifest\.js/)?.[1];
let onDisk = null;
try { onDisk = readFileSync(new URL('../../.next/BUILD_ID', import.meta.url), 'utf8').trim(); } catch {}
if (served && onDisk) {
  if (served === onDisk) ok.push(`build id ${served} matches .next/BUILD_ID`);
  else fail.push(`BUILD DRIFT — server booted ${served}, disk now holds ${onDisk}. `
    + `The server is serving a build that no longer exists; restart it before capturing.`);
} else {
  ok.push(`build id not asserted (served=${served ?? 'n/a'} disk=${onDisk ?? 'n/a'})`);
}

// 2. every referenced asset resolves, with a plausible content-type
const assets = [
  ...[...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => ['css', m[1]]),
  ...[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => ['js', m[1]]),
];
const seen = new Set();
let cssBodies = '';
for (const [kind, href] of assets) {
  if (seen.has(href)) continue;
  seen.add(href);
  const url = href.startsWith('http') ? href : BASE + href;
  const r = await fetch(url);
  const ct = r.headers.get('content-type') || '';
  const body = await r.text();
  if (!r.ok) {
    fail.push(`${kind} ${href} -> HTTP ${r.status}`);
    continue;
  }
  const wrongType = kind === 'css' ? !ct.includes('css') : !/javascript|ecmascript/.test(ct);
  if (wrongType) {
    fail.push(`${kind} ${href} -> 200 but content-type "${ct}" (an error page served in its place?)`);
    continue;
  }
  if (kind === 'css') cssBodies += body;
  ok.push(`${kind} ${href.split('/').pop()} 200 ${ct.split(';')[0]}`);
}

// 3. the sentinel rule is actually present
if (cssBodies.includes(SENTINEL)) ok.push(`sentinel rule "${SENTINEL}" present in served CSS`);
else fail.push(`sentinel rule "${SENTINEL}" NOT in any served stylesheet — `
  + `the page will render at browser defaults and every measurement below will be wrong.`);

for (const line of ok) console.log(`  ok    ${line}`);
for (const line of fail) console.error(`  FAIL  ${line}`);
console.log(fail.length ? `\nasset-integrity FAIL — ${fail.length} problem(s)` : `\nasset-integrity PASS — ${ok.length} checks`);
process.exit(fail.length ? 1 : 0);
