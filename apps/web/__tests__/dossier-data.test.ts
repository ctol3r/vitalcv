import { describe, expect, it } from 'vitest';

import {
  VERB_META,
  computeDossierCounts,
  demoDossier,
  isChainConsistent,
  type CustodyRow,
  type LedgerVerb,
} from '@/lib/dossier/dossierData';

const BANNED = [
  ['automatically', 'verified'].join(' '),
  ['guaranteed', 'verification'].join(' '),
  ['complete', 'credentialing'].join(' '),
  ['instant', 'credentialing'].join(' '),
  ['legally', 'accepted'].join(' '),
  ['risk', 'transferred'].join(' '),
  ['final', 'verification', 'without', 'review'].join(' '),
  ['source', 'confirmed', 'before', 'response'].join(' '),
  ['certified', 'compliant'].join(' '),
  ['HIPAA', 'compliant'].join(' '),
  ['SOC2', 'certified'].join(' '),
];

describe('VERB_META', () => {
  it('has the 6 design-mandated verbs', () => {
    expect(Object.keys(VERB_META)).toEqual([
      'source_confirmed',
      'no_match',
      'no_actions',
      'attested',
      'committed',
      'anchored',
    ]);
  });

  it('uses "Source-confirmed" instead of bare "Verified" for the strongest verb', () => {
    expect(VERB_META.source_confirmed.label).toBe('Source-confirmed');
    for (const meta of Object.values(VERB_META)) {
      expect(meta.label).not.toBe('Verified');
      expect(meta.label).not.toBe('VERIFIED');
    }
  });
});

describe('demoDossier — meta', () => {
  it('isDemo === literal true', () => {
    expect(demoDossier().meta.isDemo).toBe(true);
  });

  it('signing key contains "demo" so it cannot be mistaken for a production DID', () => {
    const k = demoDossier().meta.signingKey.toLowerCase();
    expect(k).toContain('demo');
  });

  it('algorithm string contains the literal "demo" marker', () => {
    expect(demoDossier().meta.algorithm.toLowerCase()).toContain('demo');
  });

  it('rootHash matches the last ledger row hash (anchor)', () => {
    const d = demoDossier();
    const last = d.ledger[d.ledger.length - 1];
    expect(d.meta.rootHash).toBe(last.hash);
  });
});

describe('demoDossier — ledger', () => {
  it('has 11 rows covering all 6 verbs', () => {
    const d = demoDossier();
    expect(d.ledger.length).toBe(11);
    const verbs = new Set(d.ledger.map((r) => r.verb));
    for (const v of Object.keys(VERB_META) as LedgerVerb[]) {
      expect(verbs.has(v)).toBe(true);
    }
  });

  it('first row prev is the genesis zero hash', () => {
    const d = demoDossier();
    expect(d.ledger[0].prev).toMatch(/^0x0+$/);
  });

  it('last row verb is anchored', () => {
    const d = demoDossier();
    expect(d.ledger[d.ledger.length - 1].verb).toBe('anchored');
  });

  it('hash-chain is self-consistent', () => {
    const d = demoDossier();
    expect(isChainConsistent(d.ledger)).toBe(true);
  });

  it('isChainConsistent returns false when a row breaks the chain', () => {
    const d = demoDossier();
    const broken: CustodyRow[] = [...d.ledger];
    // Mutate the third row's prev to no longer match row 2's hash.
    broken[2] = { ...broken[2], prev: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' };
    expect(isChainConsistent(broken)).toBe(false);
  });

  it('every actor is a vendor-neutral demo identifier', () => {
    const d = demoDossier();
    for (const r of d.ledger) {
      expect(r.actor.toLowerCase()).toMatch(/^(demo:|human:demo|committee:demo)/);
    }
  });

  it('does NOT name specific upstream vendors in source urls', () => {
    const d = demoDossier();
    const blob = JSON.stringify(d.ledger);
    const vendorPatterns: ReadonlyArray<RegExp> = [
      /npiregistry\.cms\.hhs\.gov/i,
      /\boig\b/i,
      /\bsam\.gov\b/i,
      /\bnpdb\b/i,
      /\bdca\b/i,
      /\bdea\b/i,
      /\baamc\b/i,
      /\bnccpa\b/i,
      /cedar/i,
      /\bcms\.hhs\b/i,
    ];
    for (const p of vendorPatterns) {
      expect(blob).not.toMatch(p);
    }
  });
});

describe('demoDossier — receipt detail', () => {
  it('signature is clearly stub (contains "demo-signature" and "stub")', () => {
    const sig = demoDossier().receiptDetail.signature.sig;
    expect(sig).toContain('demo-signature');
    expect(sig.toLowerCase()).toContain('stub');
  });

  it('result.status is the typed "no_match" literal', () => {
    expect(demoDossier().receiptDetail.envelope.result.status).toBe('no_match');
  });

  it('subject NPI is the all-zero demo placeholder', () => {
    expect(demoDossier().receiptDetail.envelope.subject.npi).toBe('0000000000');
  });
});

describe('demoDossier — regulatory mapping', () => {
  it('has 10 rows covering NCQA / TJC / CMS', () => {
    const d = demoDossier();
    expect(d.regMapping.length).toBe(10);
    const auths = new Set(d.regMapping.map((m) => m.authority));
    expect(auths.has('NCQA')).toBe(true);
    expect(auths.has('TJC')).toBe(true);
    expect(auths.has('CMS')).toBe(true);
  });

  it('every row references a real receipt id from the ledger', () => {
    const d = demoDossier();
    const ids = new Set(d.ledger.map((r) => r.id));
    for (const m of d.regMapping) {
      expect(ids.has(m.receiptId)).toBe(true);
    }
  });
});

describe('computeDossierCounts', () => {
  it('matches the demo composition', () => {
    const d = demoDossier();
    const c = computeDossierCounts(d);
    expect(c.total).toBe(11);
    expect(c.satisfiedStandards).toBe(10);
    expect(c.totalStandards).toBe(10);
    // verb breakdown — sum equals total.
    const sum = Object.values(c.byVerb).reduce((a, b) => a + b, 0);
    expect(sum).toBe(c.total);
    expect(c.byVerb.anchored).toBe(1);
    expect(c.byVerb.committed).toBe(1);
    expect(c.byVerb.attested).toBe(1);
  });
});

describe('demoDossier — banned phrases', () => {
  it('renders no banned overclaim copy', () => {
    const d = demoDossier();
    const blob = JSON.stringify(d).toLowerCase();
    for (const phrase of BANNED) {
      expect(blob).not.toContain(phrase.toLowerCase());
    }
  });
});
