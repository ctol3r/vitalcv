/**
 * presentation-exchange-baseline.test.ts — where holder-presents-credentials lives.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Axuall holds US 12,079,891 ("Systems and methods for verifying and managing
 * digital credentials", priority 2019-01-04). Its independent claims describe:
 * configure rules on required credential attributes → define a requisite
 * collection → send it to a HOLDER as a presentation request → receive the
 * holder's proposal → verify a cryptographic proof of validity, non-revocation
 * and ownership against a registry.
 *
 * `apps/api/backend` already implements a working OpenID4VP presentation layer
 * that reads onto most of those elements. What keeps the question small today is
 * that NO PRODUCT SURFACE INVOKES IT — see docs/strategy/fto-axuall-12079891.md.
 *
 * That property is invisible and easy to destroy: one import in one page turns
 * dormant code into an exercised flow, and nothing else in the repo would say so.
 * This pins the baseline in both directions.
 *
 * THIS IS NOT A BAN. It is a stop sign. If a wave genuinely needs to grow this
 * surface, get the FTO answer first, then update the baseline in the same PR as
 * the decision — never on its own to make a build go green.
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..', '..');

/**
 * Files in DEPLOYED trees that implement DIF Presentation Exchange / OID4VP.
 *
 * Deployed means shipped under a railway.toml: the root config (apps/api/backend)
 * and apps/web. `apps/verifier-api` carries a Dockerfile.ignore and no Railway
 * config, and apps/mobile ships separately — both are out of scope here.
 */
const BASELINE = [
  'apps/api/backend/src/routes/oid4vp.ts',
  'apps/api/backend/src/services/conformance/conformanceSuite.ts',
  'apps/api/backend/src/services/oid4vp/presentationServer.ts',
  'apps/api/backend/src/services/verifier/verifierValidation.ts',
  // Orphaned: imported by no page. Its presence in this list is not an
  // exception — the "no page imports it" test below is what holds it harmless.
  'apps/web/components/verifier/AcceptancePanel.tsx',
].sort();

/** Tokens that only appear when Presentation Exchange is actually being built. */
const MARKERS = ['presentation_definition', 'input_descriptors', 'vp_token'];

function gitGrepFiles(pattern: string, paths: string[]): string[] {
  try {
    return execFileSync(
      'git',
      ['grep', '-l', '--untracked', '-e', pattern, '--', ...paths],
      { cwd: repoRoot, encoding: 'utf8' },
    )
      .split('\n')
      .filter(Boolean);
  } catch {
    return []; // git grep exits 1 with no matches
  }
}

describe('presentation-exchange surface in deployed trees', () => {
  it('has not grown beyond the recorded baseline', () => {
    const found = new Set<string>();
    for (const marker of MARKERS) {
      for (const file of gitGrepFiles(marker, ['apps/web', 'apps/api/backend'])) {
        // The W3C VC JSON-LD context vocabulary is a standards file, not our
        // code — it names these terms because the spec does.
        if (file.endsWith('.jsonld')) continue;
        // Baselines and this test name the markers in order to police them.
        if (file.includes('__tests__') || file.endsWith('-baseline.json')) continue;
        if (file.includes('_archive')) continue;
        found.add(file);
      }
    }

    expect([...found].sort()).toEqual(BASELINE);
  });
});

describe('the property that keeps it dormant', () => {
  it('no page or route imports the OID4VP-calling component', () => {
    // components/verifier/AcceptancePanel.tsx POSTs to /api/oid4vp/request.
    // The AcceptancePanel rendered on /verify/[npi] is a DIFFERENT function
    // defined locally in that page — do not conflate them.
    const importers = gitGrepFiles(
      "components/verifier/AcceptancePanel",
      ['apps/web/app', 'apps/web/components'],
    ).filter((f) => !f.includes('_archive') && !f.includes('__tests__'));

    expect(importers).toEqual([]);
  });

  it('nothing in the product calls the OID4VP endpoints', () => {
    const callers = gitGrepFiles('api/oid4vp', ['apps/web/app']).filter(
      (f) => !f.includes('_archive') && !f.includes('__tests__'),
    );

    expect(callers).toEqual([]);
  });
});
