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
 *   1. NEGATIVE — generic `wallet` must not return as a product noun on the
 *      customer surfaces this wave cleaned. Direction D.1 later ratified the
 *      exact compound `CV Wallet`; that compound is the sole exception.
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
  // The Direction A recomposition (amendment E) retired the last "CV Wallet"
  // from `/` — the acquisition surface now stays wallet-free outright, not
  // via the ratified-compound exception.
  'components/home/easy/EasyHome.tsx',
  'components/home/easy/WorkSurface.tsx',
  // Questions.tsx retired 2026-08-16 (amendment E.1); its successors carry
  // the same wallet-free commitment.
  'components/home/easy/ThreePromises.tsx',
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
  it.each(WALLET_FREE_SURFACES)('%s renders no generic "wallet" product noun', (rel) => {
    const hits = customerVisibleStrings(read(rel)).filter((s) =>
      /\bwallets?\b/i.test(s.replace(/\bCV\s+Wallet\b/gi, '')),
    );
    expect(
      hits,
      `Generic "wallet" is retired customer vocabulary. Direction D.1 permits only the exact `
        + `founder-ratified compound "CV Wallet". See docs/strategy/customer-language-inventory.md.`,
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

  it('allows only the founder-ratified CV Wallet compound', () => {
    const seen = customerVisibleStrings('<p>Open your CV Wallet</p><p>Open your wallet</p>');
    const generic = seen.filter((s) =>
      /\bwallets?\b/i.test(s.replace(/\bCV\s+Wallet\b/gi, '')),
    );
    expect(generic).toEqual(['Open your wallet']);
  });
});

/**
 * Wave L2 — `passport`. The concept is gone (the /passport route was retired by
 * #1096); what survived was vocabulary pointing at nothing. Narrower list than
 * L1 because `PassportData`, `passport` variables and `/api/passport/*` are
 * internal names the strategy says not to rename — only rendered copy is here.
 */
const PASSPORT_FREE_SURFACES = [
  'app/packet/[entityId]/PacketClient.tsx',
  'app/review/[entityId]/ReviewPageClient.tsx',
  'app/review/request/page.tsx',
  'components/advisory/AdvisoryPanel.tsx',
  'components/mobile/ClinicianPanels.tsx',
  'components/onboarding/OnboardingFlowSteps.tsx',
];

describe('customer-language guard — `passport` stays retired (L2)', () => {
  it.each(PASSPORT_FREE_SURFACES)('%s renders no "passport" product noun', (rel) => {
    const hits = customerVisibleStrings(read(rel)).filter((s) => /\bpassports?\b/i.test(s));
    expect(
      hits,
      `"passport" names a concept that no longer exists — the /passport route was retired by #1096. `
        + `See docs/strategy/customer-language-inventory.md.`,
    ).toEqual([]);
  });

  it('the attribution register no longer cites the retired /passport route', () => {
    const src = read('components/trust/TrustAttributionRegister.tsx');
    const retrievalTimes = [...src.matchAll(/retrievalTime: '([^']+)'/g)].map((m) => m[1]);
    expect(retrievalTimes.length).toBeGreaterThan(0);
    expect(retrievalTimes.some((t) => /\/passport/.test(t))).toBe(false);
    // …and the FACT each one states must survive the rename: these rows say
    // when the read happens, which is the honest part.
    expect(retrievalTimes.some((t) => /per request/i.test(t))).toBe(true);
  });
});

/**
 * Wave L4 — `snapshot`. The narrowest wave in the sequence, and the one where
 * the negative half matters LEAST. The word does four jobs and only one is
 * product vocabulary:
 *
 *   1. cadence      — "OIG/LEIE refresh on a monthly snapshot"   PROTECTED
 *   2. point-in-time — "not checked on this public snapshot"     PROTECTED
 *   3. trust state  — "OWNED SNAPSHOT" (attributed, replay-visible)  PROTECTED
 *   4. possession   — "your readiness snapshot", a thing you have and share  RETIRED
 *
 * Only (4) was touched. `readiness` itself stays — it is an allowed
 * task-specific term for a clinician's own state; what went is the artifact noun.
 */
const SNAPSHOT_FREE_SURFACES = [
  'app/concierge/page.tsx',
  'app/matcha/recruiters/page.tsx',
  'components/explore/ApplyModal.tsx',
  'components/mobile/ClinicianUpdatesSurface.tsx',
  'components/onboarding/OnboardingReadiness.tsx',
  'components/review/ReviewQueueSurface.tsx',
];

describe('customer-language guard — `snapshot`-as-possession retired (L4)', () => {
  it.each(SNAPSHOT_FREE_SURFACES)('%s no longer calls it a "readiness snapshot"', (rel) => {
    const hits = customerVisibleStrings(read(rel)).filter((s) => /\b(readiness|career)\s+snapshots?\b/i.test(s));
    expect(
      hits,
      `"readiness snapshot" names an artifact the customer must remember. `
        + `Keep "readiness"; drop the artifact noun.`,
    ).toEqual([]);
  });

  it('the three PROTECTED senses of "snapshot" survive — this is the half that matters', () => {
    // 1. cadence — a monthly-cadence source must never read as live
    expect(read('app/evidence-network/page.tsx')).toMatch(/monthly snapshot/i);
    expect(read('components/employers/EmployerEvidenceSection.tsx')).toMatch(/monthly snapshot/i);
    // 2. point-in-time scope limits on the public verify surface
    const verify = read('app/verify/[npi]/page.tsx');
    expect(verify).toMatch(/not checked on this public snapshot/i);
    expect(verify).toMatch(/no receipts on this snapshot/i);
    // 3. the trust-state taxonomy label and its unowned counterpart
    const legend = read('components/trust/TrustRegisterLegend.tsx');
    expect(legend).toMatch(/OWNED SNAPSHOT/);
    expect(legend).toMatch(/unowned/i);
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
