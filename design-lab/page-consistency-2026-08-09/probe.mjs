// Reachability probe: every origin/main page route against production.
// Read-only. Records status, redirect target, and content-length.
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'https://www.vitalcv.com';
// Checksum-valid but assigned to nobody — NPPES result_count 0, verified
// 2026-08-16 (npi-smoke's canonical ABSENT NPI). The committed probe-main.json
// was captured 2026-08-09 with 1407202518, which later turned out to be a real
// registrant's NPI; this is a reachability probe, and "no such record" is
// already recorded separately from "no such route", so a rerun must never pull
// a real person's record from production.
const PROBE_NPI = '1999999992';

// Substitutions for dynamic segments. A 404 here may mean "no such record",
// not "no such route" — recorded separately so the two are never conflated.
const SUB = {
  '[npi]': PROBE_NPI,
  '[entityId]': PROBE_NPI,
  '[caseId]': 'probe-nonexistent',
  '[bundleId]': 'probe-nonexistent',
  '[requestId]': 'probe-nonexistent',
  '[receiptId]': 'probe-nonexistent',
  '[applicationId]': 'probe-nonexistent',
  '[requestUri]': 'probe-nonexistent',
  '[blockerId]': 'probe-nonexistent',
  '[fileId]': 'probe-nonexistent',
  '[id]': 'probe-nonexistent',
  '[slug]': 'probe-nonexistent',
  '[[...sign-in]]': '',
  '[[...sign-up]]': '',
};

const routes = readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean);

function concretize(r) {
  let out = r;
  let dynamic = false;
  for (const [k, v] of Object.entries(SUB)) {
    if (out.includes(k)) {
      dynamic = true;
      out = out.split(k).join(v);
    }
  }
  out = out.replace(/\/+$/, '') || '/';
  return { url: out, dynamic };
}

const results = [];
let n = 0;
for (const route of routes) {
  const { url, dynamic } = concretize(route);
  const rec = { route, probed: url, dynamic };
  try {
    const res = await fetch(BASE + url, { redirect: 'manual', headers: { 'user-agent': 'vitalcv-page-audit/1.0' } });
    rec.status = res.status;
    rec.location = res.headers.get('location');
    rec.robots = res.headers.get('x-robots-tag');
    if (res.status === 200) {
      const body = await res.text();
      rec.bytes = body.length;
      rec.title = (body.match(/<title>([^<]*)<\/title>/i) || [])[1] || null;
      // Next.js renders a 404 page with status 200 in some streaming cases
      rec.notFoundMarker = /This page could not be found|404/.test(body.slice(0, 4000));
    }
  } catch (e) {
    rec.error = String(e).slice(0, 160);
  }
  results.push(rec);
  n++;
  process.stdout.write(`\r${n}/${routes.length} ${route.slice(0, 50).padEnd(50)}`);
}
console.log();
writeFileSync(process.argv[3], JSON.stringify(results, null, 1));

// summary
const by = {};
for (const r of results) {
  const k = r.error ? 'ERR' : String(r.status);
  (by[k] ||= []).push(r.route);
}
for (const [k, v] of Object.entries(by).sort()) console.log(`${k}: ${v.length}`);
