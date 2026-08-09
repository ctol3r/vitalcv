import { describe, it, expect } from 'vitest';
import {
  CREDENTIAL_DEFS,
  CREDENTIAL_ISSUERS,
  COURSE_COMPLETION_BLOCKLIST,
  KNOWN_COLLISION_TOKENS,
  ORDERING_PROFILES,
  ambiguousTokens,
  renderPostNominals,
} from '@/lib/credential-vocabulary';
import { INSTITUTIONS } from '@/lib/institutions/curated';

const issuerIds = new Set(CREDENTIAL_ISSUERS.map((i) => i.id));
const defIds = new Set(CREDENTIAL_DEFS.map((d) => d.id));
const institutionIds = new Set(INSTITUTIONS.map((i) => i.id));

describe('credential issuers', () => {
  it('has unique ids and valid institution links', () => {
    expect(issuerIds.size).toBe(CREDENTIAL_ISSUERS.length);
    for (const issuer of CREDENTIAL_ISSUERS) {
      expect(issuer.id).toMatch(/^[a-z0-9-]+$/);
      if (issuer.institutionId) {
        expect(
          institutionIds.has(issuer.institutionId),
          `${issuer.id} → unknown institution ${issuer.institutionId}`,
        ).toBe(true);
      }
    }
  });
});

describe('credential definitions', () => {
  it('has unique ids, and identity is (token, issuer) — never the token alone', () => {
    expect(defIds.size).toBe(CREDENTIAL_DEFS.length);
    const pairs = CREDENTIAL_DEFS.map((d) => `${d.token}::${d.issuerId}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('every issuer and rename target resolves; renamed rows are legacy', () => {
    for (const def of CREDENTIAL_DEFS) {
      expect(issuerIds.has(def.issuerId), `${def.id} → unknown issuer ${def.issuerId}`).toBe(true);
      if (def.renamedToId) {
        expect(defIds.has(def.renamedToId), `${def.id} → unknown rename ${def.renamedToId}`).toBe(true);
        expect(def.status, `${def.id} has renamedToId but is not legacy`).toBe('legacy');
      }
    }
  });

  it('every ambiguous token is declared, and every declared collision is real', () => {
    const ambiguous = ambiguousTokens();
    for (const token of ambiguous.keys()) {
      expect(
        KNOWN_COLLISION_TOKENS.includes(token),
        `undeclared token collision: ${token} (${ambiguous.get(token)!.map((d) => d.id).join(', ')})`,
      ).toBe(true);
    }
    for (const token of KNOWN_COLLISION_TOKENS) {
      expect(ambiguous.has(token), `declared collision ${token} is not actually ambiguous`).toBe(true);
    }
  });

  it('collision tokens are distinguishable by issuer and profession scope', () => {
    const ambiguous = ambiguousTokens();
    for (const [token, defs] of ambiguous) {
      const issuers = new Set(defs.map((d) => d.issuerId));
      expect(issuers.size, `${token} defs share an issuer`).toBe(defs.length);
    }
  });

  it('no course completion masquerades as a credential token', () => {
    for (const def of CREDENTIAL_DEFS) {
      expect(
        COURSE_COMPLETION_BLOCKLIST.includes(def.token),
        `blocklisted course token in vocabulary: ${def.token}`,
      ).toBe(false);
    }
  });
});

describe('ordering profiles and rendering', () => {
  it('declares an authority for every profile', () => {
    for (const p of ORDERING_PROFILES) expect(p.authority.length).toBeGreaterThan(10);
  });

  it('renders the ANCC nursing example in the published order', () => {
    const result = renderPostNominals(
      [
        { credentialDefId: 'faan-nursing' },
        { credentialDefId: 'fnp-bc' },
        { credentialDefId: 'rn' },
        { credentialDefId: 'dnp' },
        { credentialDefId: 'aprn' },
      ],
      'nursing',
    );
    expect(result.rendered).toBe('DNP, RN, APRN, FNP-BC, FAAN');
    expect(result.unknownIds).toEqual([]);
  });

  it('dedups lower degrees within a field but keeps cross-field degrees', () => {
    const result = renderPostNominals(
      [
        { credentialDefId: 'bsn' },
        { credentialDefId: 'msn' },
        { credentialDefId: 'dnp' },
        { credentialDefId: 'mba' },
        { credentialDefId: 'rn' },
      ],
      'nursing',
    );
    expect(result.rendered).toBe('DNP, MBA, RN');
    expect(result.excludedIds).toContain('bsn');
    expect(result.excludedIds).toContain('msn');
  });

  it('renders physicians degree-first with honors, licenses never as suffixes', () => {
    const result = renderPostNominals(
      [
        { credentialDefId: 'facc' },
        { credentialDefId: 'mph' },
        { credentialDefId: 'md' },
      ],
      'physician',
    );
    expect(result.rendered).toBe('MD, MPH, FACC');
  });

  it('renders physical therapy license-first per APTA', () => {
    const result = renderPostNominals(
      [
        { credentialDefId: 'dpt' },
        { credentialDefId: 'ocs' },
        { credentialDefId: 'pt-license' },
      ],
      'physical_therapy',
    );
    expect(result.rendered).toBe('PT, DPT, OCS');
  });

  it('fails closed: unknown ids never render, legacy and opt-outs are excluded', () => {
    const result = renderPostNominals(
      [
        { credentialDefId: 'md' },
        { credentialDefId: 'free-texted-nonsense' },
        { credentialDefId: 'rn-bc-legacy' },
        { credentialDefId: 'mba', showInSuffix: false },
      ],
      'physician',
    );
    expect(result.rendered).toBe('MD');
    expect(result.unknownIds).toEqual(['free-texted-nonsense']);
    expect(result.excludedIds).toContain('rn-bc-legacy');
    expect(result.excludedIds).toContain('mba');
  });
});
