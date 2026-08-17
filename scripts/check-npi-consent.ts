/**
 * NPI consent gate — no check-digit-VALID NPI may enter source without consent.
 *
 * A check-digit-valid NPI is not a number. It is a person. NPPES enumerates it
 * to a named human being with a specialty and a practice address, and anyone
 * holding the number can retrieve all three in one unauthenticated request.
 * When one appears in a fixture, a seed script, a demo constant or a rendered
 * page, VitalCV is making assertions about a real clinician who was never
 * asked — which is precisely the incident class this repository keeps
 * rediscovering:
 *
 *   2026-03  seed scripts wrote invented licences and sanctions about real,
 *            named physicians into the production database.
 *   2026-08-10  the dev page-stack harness rendered a real physician's named
 *            record; the NPI there was swapped for a check-digit-invalid one.
 *   2026-08-16  /trust/doctrine — public, no-auth, server-rendered — was found
 *            printing a real enumerated provider's name beside
 *            status: 'verified' and tier: 'T3'. The same substitution as
 *            2026-08-10, six days later, on the surface strangers can read.
 *
 * Each fix was correct and each was local. Nothing stopped the next one,
 * because nothing was checking. This is that check.
 *
 * THE RULE. Every check-digit-valid NPI appearing in scanned source must be
 * listed in the consent register projection (see CONSENT_PATH) with a recorded
 * basis, or in the reviewed baseline below. The baseline may SHRINK, never
 * grow — the same ratchet contract as the header-trust gate, and for the same
 * reason: a list that may grow measures a hole instead of closing it.
 *
 * WHAT IS DELIBERATELY OUT OF SCOPE.
 *
 * `apps/web/lib/directory/sitemap-seed.json` holds 4,955 real NPIs and is NOT
 * scanned. That file is the public-directory beachhead — a known, founder-owned
 * values decision about publishing records for clinicians who never enrolled,
 * recorded as an open founder decision rather than a defect. Folding it in here
 * would bury a decision the founder must make under a check an agent can
 * silence. If that decision is ever made, it belongs in the consent register,
 * not in this exemption.
 *
 * Check-digit-INVALID numbers are unrestricted: they cannot name anyone. That
 * is the whole reason the substitution convention picks them.
 */

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const REPO_ROOT = process.cwd();
const CONSENT_PATH = join('consent', 'consented-npis.json');

/** Directories scanned for NPIs in source. */
const SCAN_ROOTS = ['apps', 'packages', 'scripts'];

const SOURCE_EXT = new Set(['.ts', '.tsx', '.mjs', '.cjs', '.js', '.jsx']);

/** Paths never scanned — see "deliberately out of scope" above. */
const EXEMPT_PATHS = new Set([
  join('apps', 'web', 'lib', 'directory', 'sitemap-seed.json'),
]);

/**
 * Only git-TRACKED files are scanned. Walking the filesystem instead made the
 * result depend on whether a build had run in the working tree — the scan moved
 * 4251 → 4275 files after `turbo build`, which would let the gate disagree with
 * itself between a developer's machine and a clean CI checkout. Tracked files
 * are exactly the things a pull request can introduce an NPI through.
 */
function trackedSourceFiles(): string[] {
  const out = execFileSync(
    'git',
    ['ls-files', '-z', '--', ...SCAN_ROOTS.map((r) => `${r}/`)],
    { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return out
    .split('\0')
    .filter(Boolean)
    .filter((p) => {
      const dot = p.lastIndexOf('.');
      return dot !== -1 && SOURCE_EXT.has(p.slice(dot));
    });
}

/**
 * NPI check digit: Luhn over the constant issuer prefix 80840 concatenated with
 * the first nine digits. This is the same algorithm the product's own validator
 * uses; it is reproduced here so the gate has no workspace build dependency.
 */
function isValidNpi(n: string): boolean {
  if (!/^\d{10}$/.test(n)) return false;
  const digits = ('80840' + n.slice(0, 9)).split('').map(Number);
  let sum = 0;
  let double = true;
  for (let i = digits.length - 1; i >= 0; i--) {
    let v = digits[i];
    if (double) {
      v *= 2;
      if (v > 9) v -= 9;
    }
    sum += v;
    double = !double;
  }
  return (10 - (sum % 10)) % 10 === Number(n[9]);
}

const files = trackedSourceFiles();

/** npi -> set of repo-relative files it appears in */
const found = new Map<string, Set<string>>();

for (const rel of files) {
  if (EXEMPT_PATHS.has(rel)) continue;
  let text: string;
  try {
    text = readFileSync(join(REPO_ROOT, rel), 'utf8');
  } catch {
    continue;
  }
  // Word-boundaried so a 10-digit run inside a longer number is not an NPI.
  for (const m of text.matchAll(/(?<!\d)\d{10}(?!\d)/g)) {
    if (!isValidNpi(m[0])) continue;
    if (!found.has(m[0])) found.set(m[0], new Set());
    found.get(m[0])!.add(rel);
  }
}

type ConsentFile = {
  consented?: Array<{ npi: string; basis?: string }>;
  baselineUnconsentedNpis?: Record<string, string[]>;
};

let consent: ConsentFile;
try {
  consent = JSON.parse(readFileSync(join(REPO_ROOT, CONSENT_PATH), 'utf8')) as ConsentFile;
} catch {
  console.error(`check-npi-consent: cannot read consent register at ${CONSENT_PATH}`);
  process.exit(2);
}

const consented = new Set((consent.consented ?? []).map((c) => c.npi));
const baseline = consent.baselineUnconsentedNpis ?? {};

const violations: Array<{ npi: string; files: string[] }> = [];
const baselineResolved: string[] = [];

for (const [npi, fileSet] of found) {
  if (consented.has(npi)) continue;
  const allowedFiles = new Set(baseline[npi] ?? []);
  const newFiles = [...fileSet].filter((f) => !allowedFiles.has(f)).sort();
  if (newFiles.length > 0) violations.push({ npi, files: newFiles });
}

// Baseline entries whose files no longer carry the NPI — the ratchet may shrink.
for (const [npi, allowed] of Object.entries(baseline)) {
  const still = found.get(npi) ?? new Set<string>();
  const gone = allowed.filter((f) => !still.has(f));
  if (gone.length > 0) baselineResolved.push(`${npi}: ${gone.join(', ')}`);
}

console.log(
  `Scanned ${files.length} source file(s); ${found.size} distinct check-digit-valid NPI(s) present ` +
    `(${consented.size} consented, ${Object.keys(baseline).length} in the reviewed baseline).`,
);

if (baselineResolved.length > 0) {
  console.log(`\n✓ ${baselineResolved.length} baseline entr(ies) no longer present — trim them:`);
  for (const line of baselineResolved) console.log(`    ${line}`);
}

if (violations.length > 0) {
  console.error(
    `\nFAIL — ${violations.length} check-digit-valid NPI(s) appear in source outside the consent ` +
      `register and outside the reviewed baseline:\n`,
  );
  for (const v of violations) {
    console.error(`  ${v.npi}`);
    for (const f of v.files) console.error(`      ${f}`);
  }
  console.error(
    `\nA check-digit-valid NPI resolves to a named person in NPPES. Do one of:\n` +
      `  1. Use a check-digit-INVALID number. It cannot name anyone, which is why the\n` +
      `     substitution convention picks them. Preserve the final digit if a sandbox\n` +
      `     connector branches on it.\n` +
      `  2. If the subject genuinely consented, add them to ${CONSENT_PATH} under\n` +
      `     "consented" with the basis recorded.\n` +
      `\nDo NOT add a new entry to baselineUnconsentedNpis to make this pass. That list\n` +
      `may shrink, never grow — it is the record of work outstanding, not an allowlist.\n`,
  );
  process.exit(1);
}

console.log('\nPASS — every check-digit-valid NPI in source is consented or within the reviewed baseline.');
process.exit(0);
