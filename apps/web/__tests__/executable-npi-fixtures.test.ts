/**
 * No file that can EXECUTE, RENDER or SEED may carry a real registrant's NPI.
 *
 * Only a VALID NPI check digit can name a real person, so this asserts the
 * arithmetic rather than a blocklist of known-bad numbers — a blocklist only
 * ever catches the one that already hurt someone.
 *
 * Why this tier and not the whole repo (founder's split, 2026-07-27): the sweep
 * is staged by what a file can DO. Tier 1 is executables, seeds and audit
 * scripts; tests and fixtures are mechanical hygiene later, and docs are last
 * because their occurrences are usually EVIDENCE — warnings, incident prose,
 * defect registers and dated audit records that must keep naming the real
 * number to stay true. A repo-wide assertion would demand exactly the blanket
 * replace that corrupted those guardrails last time.
 *
 * What this caught (2026-08-10): `scripts/smoke/prod.sh` POSTed `/demo/issue`
 * and `/demo/verify` to PRODUCTION with 1003000126 — a real physician — on
 * every smoke run; `scripts/launch-monitor.sh` queried the investigation graph
 * for the same person; and `app/dev/page-stack/PageStackHarness.tsx` rendered
 * their named record in a dev harness. No PR check executes shell scripts, so
 * CI was never going to see any of it.
 *
 * Protective MENTIONS are allowed and deliberately preserved — several of these
 * files name the real NPI to explain why it was removed. Stripping those
 * inverts the doctrine, which is exactly what a blanket replace did on
 * 2026-07-27 ("Do not use <synthetic>", and a real person's name attributed to
 * a synthetic number). A mention is a comment; a usage is a value.
 */
import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO = join(__dirname, '..', '..', '..');

/** Files that can execute, render, or seed — the founder's tier-1 axis. */
const TIER_1_EXPLICIT = [
  'scripts/smoke/prod.sh',
  'scripts/launch-monitor.sh',
  'apps/web/app/dev/page-stack/PageStackHarness.tsx',
  'apps/api/backend/scripts/seed-provider-intelligence.ts',
  'apps/api/backend/src/services/alerts/trustAlerts.ts',
  'apps/api/backend/src/agents/SanctionsAgent.ts',
  'apps/api/backend/src/agents/StateBoardAgent.ts',
];

/**
 * Every Playwright spec, discovered rather than listed.
 *
 * E2E specs are tier 1 in the only sense that matters here: they drive REAL
 * HTTP at real identifiers, so an NPI in one is a live request against that
 * person's record, not an inert fixture string. They were originally filed as
 * tier 3 ("tests — mechanical hygiene") and that was wrong.
 *
 * Proven on 2026-08-10: `relationship-drawer.spec.ts` hardcoded 1003000126 — a
 * real physician — and kept requesting his evidence graph on every CI run.
 * The tier-1 list above did not include it, so THIS GUARD WAS SCOPED TO MISS
 * IT. The Web E2E gate caught the drift only because changing the harness
 * constant orphaned the spec's copy; had both carried the real NPI, both would
 * have stayed green forever.
 *
 * Globbed, not enumerated, so a NEW spec cannot slip in unlisted — which is
 * exactly how the last one survived.
 */
function e2eSpecs(): string[] {
  const dir = 'apps/web/tests/e2e';
  return readdirSync(join(REPO, dir))
    .filter((f) => f.endsWith('.spec.ts') || f.endsWith('.spec.tsx'))
    .map((f) => `${dir}/${f}`)
    .sort();
}

const TIER_1 = [...TIER_1_EXPLICIT, ...e2eSpecs()];

/**
 * NPIs whose check digit is VALID but which the registry does not assign.
 *
 * A valid check digit means a number COULD be assigned, not that it IS. The
 * arithmetic is the cheap screen; only NPPES can settle it, and a unit test
 * must not make a network call. So each entry here records a value verified
 * against `npiregistry.cms.hhs.gov` as unassigned, with the date checked.
 *
 * This is deliberately NOT a general escape hatch: adding a number here is
 * asserting you asked the registry and it answered `result_count: 0`. If that
 * ever changes — CMS does reissue ranges — the entry is wrong and the guard
 * silently stops protecting a real person. Re-verify when touching this list.
 */
const VERIFIED_UNASSIGNED: Record<string, string> = {
  // Sequential digits + check digit; the canonical well-formed-but-nonexistent
  // test number, used across ~11 specs on purpose. Verified 2026-08-10:
  // result_count 0. Also the NPI behind the /verify not-found truth contract.
  '1234567893': 'NPPES result_count 0, verified 2026-08-10',
};

/** The official NPI check digit: Luhn over the number prefixed with 80840. */
function hasValidCheckDigit(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false;
  const digits = npi.split('').map(Number);
  const check = digits[9];
  let total = 24; // constant contribution of the 80840 prefix
  for (let i = 0; i < 9; i += 1) {
    let d = digits[8 - i];
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    total += d;
  }
  return (10 - (total % 10)) % 10 === check;
}

/** A line that explains a real NPI rather than using one. */
function isProtectiveMention(line: string): boolean {
  return /^\s*(\/\/|\*|#|\/\*)/.test(line);
}

describe('tier-1 executables carry no real registrant NPI', () => {
  it('agrees with NPPES on the check-digit arithmetic', () => {
    // 1003000126 is ARDALAN ENKESHAFI (NPPES result_count 1); 1558395516 is the
    // sanctioned synthetic (result_count 0), same final digit.
    expect(hasValidCheckDigit('1003000126')).toBe(true);
    expect(hasValidCheckDigit('1558395516')).toBe(false);
  });

  it.each(TIER_1)('%s uses no check-digit-valid NPI', (rel) => {
    const lines = readFileSync(join(REPO, rel), 'utf8').split('\n');
    const offenders: string[] = [];

    lines.forEach((line, i) => {
      if (isProtectiveMention(line)) return; // comments may name the real NPI
      for (const candidate of line.match(/\b\d{10}\b/g) ?? []) {
        if (!hasValidCheckDigit(candidate)) continue;
        if (candidate in VERIFIED_UNASSIGNED) continue; // registry says nobody holds it
        offenders.push(`${rel}:${i + 1}  ${candidate}  ${line.trim().slice(0, 90)}`);
      }
    });

    expect(
      offenders,
      `A valid NPI check digit means the number can name a real person, and this file can ` +
        `execute, render or seed. Substitute a check-digit-invalid NPI PRESERVING THE FINAL ` +
        `DIGIT (the sandbox connectors branch on it), then verify NPPES returns ` +
        `result_count 0.\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('keeps the protective mentions that explain the removal', () => {
    // These files name the real NPI on purpose. If a future sweep strips them,
    // the doctrine is lost and the next person re-introduces it.
    const sanctions = readFileSync(join(REPO, 'apps/api/backend/src/agents/SanctionsAgent.ts'), 'utf8');
    expect(sanctions).toContain('1003000126');
    expect(sanctions).toMatch(/real\s*\n?\s*\*?\s*physician/);
  });
});
