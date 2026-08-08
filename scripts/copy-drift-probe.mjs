#!/usr/bin/env node
/**
 * Public-copy drift probe.
 *
 * The unit guard (`apps/web/__tests__/customer-language-guard.test.ts`) stops
 * retired vocabulary from reaching `main`. This probe answers a different
 * question: does PRODUCTION still say what we think it says?
 *
 * Those are not the same question in this repo. A CONFLICTING PR skips every
 * `pull_request` gate; a non-main base ref skips them too; a rollback can serve
 * an older build indefinitely. Each of those can put copy on production that no
 * merged guard ever saw.
 *
 * Contract, not phrasing. This asserts CONCEPTS — a retired noun is absent, a
 * freshness window is stated — never exact sentences, so copy can keep
 * iterating without turning this red. (Design Lab charter: "test concepts and
 * prohibited claims, not every sentence".)
 *
 * Exit codes:
 *   0  contract holds
 *   1  DRIFT — production contradicts the contract
 *   2  NO SIGNAL — production could not be read; makes no claim either way
 */

const BASE = process.env.PROBE_BASE ?? 'https://vitalcv.com';
const ATTEMPTS = 3;

/** Retired customer nouns, by the surfaces the language waves cleaned. */
const ABSENT = [
  { route: '/onboarding', terms: [/\bwallets?\b/i, /\bpassports?\b/i] },
  { route: '/get-ready', terms: [/\bwallets?\b/i, /\bpassports?\b/i] },
  { route: '/trust', terms: [/\bwallets?\b/i, /\bpassports?\b/i] },
  { route: '/employers', terms: [/\bwallets?\b/i, /\bpassports?\b/i] },
  { route: '/concierge', terms: [/\breadiness snapshot\b/i] },
];

/**
 * Truth qualifiers. These matter MORE than the absences above: a copy edit that
 * drops a freshness window makes a monthly-cadence source read as live, and
 * every other check would still pass.
 */
const PRESENT = [
  { route: '/evidence-network', terms: [/monthly/i, /quarterly/i], why: 'source cadence windows' },
  { route: '/employers', terms: [/not a credentialing service|decision stays|committee/i], why: 'the decision boundary' },
  { route: '/employers', terms: [/not authority to act for it/i], why: 'identity ≠ authority' },
];

async function readRoute(route) {
  let lastErr;
  for (let i = 0; i < ATTEMPTS; i++) {
    try {
      const res = await fetch(`${BASE}${route}`, {
        headers: { 'user-agent': 'vitalcv-copy-drift-probe' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      // Strip script/style first so RSC payload can't satisfy an assertion,
      // then strip tags and normalise whitespace to what a reader sees.
      return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&rsquo;|&#8217;/g, '’')
        .replace(/\s+/g, ' ');
    } catch (err) {
      lastErr = err;
      if (i < ATTEMPTS - 1) await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw Object.assign(new Error(`unreadable ${route}: ${lastErr?.message}`), { noSignal: true });
}

const results = [];
let noSignal = false;

for (const { route, terms } of ABSENT) {
  let text;
  try { text = await readRoute(route); } catch (e) { noSignal = true; results.push(['NOSIG', `${route} — ${e.message}`]); continue; }
  for (const re of terms) {
    const m = text.match(re);
    if (m) results.push(['DRIFT', `${route} renders retired noun "${m[0]}"`]);
    else results.push(['OK', `${route} free of ${re}`]);
  }
}

for (const { route, terms, why } of PRESENT) {
  let text;
  try { text = await readRoute(route); } catch (e) { noSignal = true; results.push(['NOSIG', `${route} — ${e.message}`]); continue; }
  for (const re of terms) {
    if (re.test(text)) results.push(['OK', `${route} still states ${why}`]);
    else results.push(['DRIFT', `${route} LOST ${why} — truth-qualifier regression`]);
  }
}

const drift = results.filter(([s]) => s === 'DRIFT');
console.log(`\npublic-copy drift probe · ${BASE}\n`);
for (const [s, m] of results) console.log(`${s.padEnd(6)} ${m}`);

if (drift.length) {
  console.log(`\n${drift.length} DRIFT finding(s). Production contradicts the copy contract.`);
  console.log('See docs/strategy/customer-language-inventory.md and docs/design/design-lab/.');
  process.exit(1);
}
if (noSignal) {
  console.log('\nNO SIGNAL — production could not be read. This run makes no claim about drift.');
  process.exit(2);
}
console.log(`\nContract holds (${results.length} assertions).`);
process.exit(0);
