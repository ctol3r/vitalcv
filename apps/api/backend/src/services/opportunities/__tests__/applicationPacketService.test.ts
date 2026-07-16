/**
 * Wave 0 (Seal) Bundle 0.1 — the immutable packet's pure contract.
 *
 * Acceptance-gate assertions encoded here:
 *  - packet hash is stable (key order, process restarts);
 *  - any content change produces a different hash;
 *  - the exact stored packet replays and verifies after "current" state moves
 *    (the packet never rereads mutable state — it can't, it's pure data);
 *  - disclosure selection filters fields — no silent forced disclosure;
 *  - a packet cannot seal without consent or without field-level evidence.
 */

import {
  buildFieldEntriesFromTrustState,
  canonicalize,
  hashPacketContent,
  sealPacket,
  verifySealedPacket,
  type ApplicationPacketContent,
  type PacketFieldEntry,
} from '../applicationPacketService';

const FIELD: PacketFieldEntry = {
  sectionId: 'identity',
  fieldId: 'identity.identity.nppes',
  label: 'identity',
  value: 'NPI 1558302470 · Dr. Example',
  evidenceState: 'source_backed',
  sourceId: 'nppes',
  sourceObservedAt: '2026-07-16T12:00:00.000Z',
  freshUntil: '2026-10-14T12:00:00.000Z',
  artifactId: 'artifact-1',
  receiptId: null,
};

const CONTENT: ApplicationPacketContent = {
  applicationId: '4b6f0000-0000-4000-8000-000000000001',
  packetVersion: 1,
  clerkUserId: 'user_abc',
  clinicianNpi: '1558302470',
  opportunityId: '4b6f0000-0000-4000-8000-000000000002',
  employerOrgId: 'org_slug_example',
  purpose: 'application',
  recipient: 'Example Health System',
  selectedSections: ['identity', 'exclusions'],
  fields: [FIELD],
  clinicianNote: 'Available to start in August.',
  methodologyVersion: '243.3',
  consentAt: '2026-07-16T12:05:00.000Z',
  consentReceiptId: 'consent-receipt-1',
};

describe('canonicalize', () => {
  it('is key-order independent', () => {
    expect(canonicalize({ b: 1, a: { d: null, c: 'x' } })).toBe(
      canonicalize({ a: { c: 'x', d: null }, b: 1 }),
    );
  });

  it('drops undefined but preserves null (disclosed-as-absent is a value)', () => {
    expect(canonicalize({ a: undefined, b: null })).toBe('{"b":null}');
  });

  it('refuses non-data content', () => {
    expect(() => canonicalize({ f: () => 1 })).toThrow();
    expect(() => canonicalize({ n: Number.NaN })).toThrow();
  });
});

describe('packet seal + hash', () => {
  it('hash is stable for identical content', () => {
    expect(hashPacketContent(CONTENT)).toBe(hashPacketContent({ ...CONTENT }));
  });

  it('any field value change changes the hash', () => {
    const changedValue = {
      ...CONTENT,
      fields: [{ ...FIELD, value: 'NPI 1558302470 · Dr. Changed' }],
    };
    const changedFreshness = {
      ...CONTENT,
      fields: [{ ...FIELD, freshUntil: '2026-12-01T00:00:00.000Z' }],
    };
    expect(hashPacketContent(changedValue)).not.toBe(hashPacketContent(CONTENT));
    expect(hashPacketContent(changedFreshness)).not.toBe(hashPacketContent(CONTENT));
    expect(hashPacketContent({ ...CONTENT, consentReceiptId: 'other' })).not.toBe(
      hashPacketContent(CONTENT),
    );
  });

  it('REPLAY: the stored packet verifies after current state moves on', () => {
    const sealed = sealPacket(CONTENT);
    // Simulate storage round-trip (JSONB) + later Wallet churn: nothing the
    // packet references is reread — replay is pure data → hash must verify.
    const stored = JSON.parse(JSON.stringify(sealed));
    expect(verifySealedPacket(stored)).toBe(true);
    // Tampering (or accidental mutation) breaks the seal loudly.
    const tampered = { ...stored, fields: [{ ...FIELD, evidenceState: 'checked' }] };
    expect(verifySealedPacket(tampered)).toBe(false);
  });

  it('cannot seal without consent', () => {
    expect(() => sealPacket({ ...CONTENT, consentReceiptId: '' })).toThrow(/consent/i);
  });

  it('cannot seal a score-only packet (fields are mandatory)', () => {
    expect(() => sealPacket({ ...CONTENT, fields: [] })).toThrow(/field/i);
  });
});

describe('buildFieldEntriesFromTrustState', () => {
  const trustState = {
    npi: '1558302470',
    facts: [
      {
        factType: 'identity',
        source: 'NPPES',
        status: 'source_backed',
        verifiedAt: '2026-07-16T11:00:00.000Z',
        expiresAt: '2026-10-14T11:00:00.000Z',
        details: 'NPI active · name match',
      },
      {
        factType: 'exclusion',
        source: 'OIG_LEIE',
        status: 'clear',
        verifiedAt: '2026-07-16T11:01:00.000Z',
        details: 'No exclusion found',
      },
      {
        factType: 'licensure',
        source: 'STATE_BOARD',
        status: 'access_required',
        details: 'Source access required',
      },
    ],
  };

  it('maps facts to per-field entries with source + observation time', () => {
    const entries = buildFieldEntriesFromTrustState(trustState, [
      'identity',
      'exclusions',
      'licensure',
    ]);
    expect(entries).toHaveLength(3);
    const identity = entries.find((entry) => entry.sectionId === 'identity')!;
    expect(identity.sourceId).toBe('nppes');
    expect(identity.sourceObservedAt).toBe('2026-07-16T11:00:00.000Z');
    expect(identity.evidenceState).toBe('source_backed');
    const licensure = entries.find((entry) => entry.sectionId === 'licensure')!;
    expect(licensure.evidenceState).toBe('access_required');
    expect(licensure.value).toBe('Source access required');
  });

  it('disclosure selection filters sections — nothing outside it leaks', () => {
    const entries = buildFieldEntriesFromTrustState(trustState, ['identity']);
    expect(entries).toHaveLength(1);
    expect(entries[0].sectionId).toBe('identity');
  });

  it('entry order is deterministic regardless of fact order', () => {
    const reversed = {
      ...trustState,
      facts: [...trustState.facts].reverse(),
    };
    expect(buildFieldEntriesFromTrustState(reversed, ['identity', 'exclusions', 'licensure'])).toEqual(
      buildFieldEntriesFromTrustState(trustState, ['identity', 'exclusions', 'licensure']),
    );
  });
});
