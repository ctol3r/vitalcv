/**
 * Customer-language guard — wave L1 of the language inventory
 * (`docs/strategy/customer-language-inventory.md`).
 *
 * This closes an AUDIENCE gap, not an absence. `buyer-proof-page.test.tsx`
 * already bans `wallet` via BUYER_BANNED_STRINGS and works; nothing equivalent
 * covered clinician surfaces, so the noun stayed rigorously banned where an
 * employer would read it and drifted onto `/onboarding`, where a clinician
 * starts. (The homepage was supposed to be covered by
 * `strategy-messaging-guard.test.tsx`, which exists only in an unmerged PR.)
 *
 * Two directions, deliberately.
 *
 *   1. NEGATIVE — `wallet` must not return as a product noun on the customer
 *      surfaces this wave cleaned.
 *   2. POSITIVE — the truth qualifiers must REMAIN. ~45 occurrences of the
 *      retire-tier words are freshness windows and limitation clauses, not
 *      vocabulary. A future find-and-replace that strips them would pass a
 *      one-way guard while deleting the honesty the product is built on.
 *
 * Concepts, not punctuation: these assert on presence/absence of a term in a
 * file, never on exact sentences, so copy can still be iterated freely.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** Surfaces cleaned by wave L1. Adding a file here is a commitment. */
const WALLET_FREE_SURFACES = [
  'app/get-ready/GetReadySurface.tsx',
  'app/onboarding/page.tsx',
  'app/trust/page.tsx',
  'app/holder/page.tsx',
  'app/holder/layout.tsx',
  'app/auth/resolving/page.tsx',
  'app/opportunities/[id]/page.tsx',
  'components/onboarding/OnboardingReadiness.tsx',
  'components/mobile/ClinicianHomeSurface.tsx',
  'components/ui/CommandPalette.tsx',
];

/**
 * Extract only what a customer can READ: JSX text nodes and prose string
 * literals. Deliberately NOT flagged, because none of it reaches a customer and
 * changing it has real cost:
 *   - component/icon identifiers (`<Wallet />`, `import { CredentialWallet }`)
 *   - element ids and in-page anchors (`#share-wallet`) — deep links break
 *   - analytics keys (`topic="cv-wallet"`) — event continuity breaks
 *   - comments — several legitimately explain WHY the noun was retired
 *
 * This mirrors the measurement method in the language inventory, so the guard
 * and the audit agree on what "customer-visible" means.
 */
export function customerVisibleStrings(src: string): string[] {
  const withoutComments = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  const out: string[] = [];
  for (const m of withoutComments.matchAll(/>([^<>{}]{3,})</g)) {
    const t = m[1].trim();
    if (/[a-z]{3}/i.test(t)) out.push(t);
  }
  for (const m of withoutComments.matchAll(/(\w+)?\s*[:=]\s*['"`]([^'"`\n]{3,})['"`]/g)) {
    const key = (m[1] ?? '').toLowerCase();
    // Attribute/identifier slots that are not customer copy.
    if (['id', 'href', 'topic', 'icon', 'key', 'classname', 'datatestid', 'name', 'action', 'ref', 'src'].includes(key)) continue;
    const t = m[2].trim();
    if (!/\s/.test(t)) continue;              // single tokens are identifiers
    if (/^[\w/.\-@#]+$/.test(t)) continue;    // paths, anchors, package names
    out.push(t);
  }
  return out;
}

describe('customer-language guard — `wallet` stays retired (L1)', () => {
  it.each(WALLET_FREE_SURFACES)('%s renders no "wallet" product noun', (rel) => {
    const hits = customerVisibleStrings(read(rel)).filter((s) => /\bwallets?\b/i.test(s));
    expect(
      hits,
      `"wallet" is retired customer vocabulary — the canonical noun is "your VitalCV profile". `
        + `See docs/strategy/customer-language-inventory.md.`,
    ).toEqual([]);
  });

  it('the extractor sees real copy and ignores identifiers (guard-the-guard)', () => {
    const sample = `
      import { Wallet } from 'lucide-react';
      const x = { id: 'Wallet', href: '/holder', topic: 'cv-wallet', label: 'Open my wallet' };
      <p>Your free, source-backed career wallet</p>
      <Wallet className="h-4 w-4" />
    `;
    const seen = customerVisibleStrings(sample).filter((s) => /wallet/i.test(s));
    // Both pieces of real copy are caught…
    expect(seen).toContain('Open my wallet');
    expect(seen).toContain('Your free, source-backed career wallet');
    // …and none of the identifier slots are.
    expect(seen.some((s) => s === 'cv-wallet' || s === 'Wallet' || s === '/holder')).toBe(false);
  });
});

describe('customer-language guard — truth qualifiers must survive any copy wave', () => {
  it('source-cadence windows still name their real refresh cadence', () => {
    const text = read('app/evidence-network/page.tsx');
    // The cadence words are the difference between honest and overclaimed:
    // a monthly-cadence source must never read as live.
    expect(text).toMatch(/monthly/i);
    expect(text).toMatch(/quarterly/i);
    expect(text).toMatch(/\bsnapshot\b/i);
  });

  it('verification receipts still disclaim what they do not establish', () => {
    const text = read('components/VerificationReceipts.tsx');
    expect(text).toMatch(/does not imply/i);
  });

  it('the PSV receipt surface still states that it does not finalize verification', () => {
    const text = read('app/issuer/psv-receipt/[requestId]/page.tsx');
    expect(text).toMatch(/scoped evidence/i);
    expect(text).toMatch(/does not/i);
  });

  it('the employer doorway still states the decision stays with the institution', () => {
    const text = read('app/employers/page.tsx');
    expect(text).toMatch(/not a credentialing service|decision stays/i);
  });
});
