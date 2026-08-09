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
  buildSectionAbsencesFromTrustState,
  canonicalize,
  hashPacketContent,
  sealPacket,
  verifySealedPacket,
  type ApplicationPacketContent,
  type PacketFieldEntry,
  type PacketSectionAbsence,
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

/**
 * `exclusions` is selected but contributes no field, so the packet must SAY so.
 * Sealing it silently is what let an employer read the selection as a clean
 * exclusions check.
 */
const EXCLUSIONS_ABSENCE: PacketSectionAbsence = {
  sectionId: 'exclusions',
  evidenceState: 'unavailable',
  reason: 'Nothing was found for exclusions. No usable record was obtained from its source.',
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
  sectionAbsences: [EXCLUSIONS_ABSENCE],
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

describe('opportunityVersion in the sealed content (J5b)', () => {
  it('is covered by the seal hash when present', () => {
    const withVersion = { ...CONTENT, opportunityVersion: '2026-07-17T00:00:00.000Z' };
    // A new packet that records the version must NOT hash the same as one that
    // omits it — otherwise the version would sit outside the seal.
    expect(hashPacketContent(withVersion)).not.toBe(hashPacketContent(CONTENT));
  });

  it('a packet sealed WITH a version replays and verifies', () => {
    const sealed = sealPacket({ ...CONTENT, opportunityVersion: '2026-07-17T00:00:00.000Z' });
    expect(verifySealedPacket(sealed)).toBe(true);
  });

  it('a legacy packet (no version) hashes identically whether the key is absent or undefined', () => {
    // This is the legacy-replay guarantee: the read service maps a NULL column
    // to `undefined`, and canonicalize drops undefined — so a legacy packet's
    // reconstructed content hashes to exactly its original stored seal.
    const omitted = hashPacketContent(CONTENT);
    const undef = hashPacketContent({ ...CONTENT, opportunityVersion: undefined });
    expect(undef).toBe(omitted);
  });

  it('a legacy sealed packet still verifies after the field is added to the type', () => {
    const legacySeal = sealPacket(CONTENT); // sealed without opportunityVersion
    // Reconstruction path for a legacy row: null column → undefined → omitted.
    const reconstructed = { ...legacySeal, opportunityVersion: undefined };
    expect(verifySealedPacket(reconstructed)).toBe(true);
  });

  it('a null version key would BREAK legacy verification — the reason we map null→undefined', () => {
    const legacySeal = sealPacket(CONTENT);
    // If the read service naively passed the NULL column through as null:
    const naiveNull = { ...legacySeal, opportunityVersion: null } as unknown as typeof legacySeal;
    expect(verifySealedPacket(naiveNull)).toBe(false);
  });
})

describe('explicit section absences in the seal', () => {
  /**
   * The defect: `selectedSections` naming a section that produced no field, with
   * nothing in the packet saying so. An employer reads the selection, sees no
   * licensure row, and concludes licensure was checked and clean — when nothing
   * was found at all.
   */
  it('OUTCOME: a selected section that produced nothing cannot be sealed silently', () => {
    const silent = {
      ...CONTENT,
      selectedSections: ['identity', 'exclusions', 'licensure'],
      // licensure contributes no field AND carries no absence.
    };
    expect(() => sealPacket(silent)).toThrow(/licensure/);

    // Naming it explicitly is what makes the packet sealable.
    const explained = {
      ...silent,
      sectionAbsences: [
        EXCLUSIONS_ABSENCE,
        {
          sectionId: 'licensure',
          evidenceState: 'access_required' as const,
          reason: 'Nothing was found for licensure. The route is gated.',
        },
      ],
    };
    expect(() => sealPacket(explained)).not.toThrow();
  });

  it('rejects an absence that contradicts the packet it is sealed into', () => {
    // identity HAS a field — claiming it is absent would be a lie inside the seal.
    expect(() => sealPacket({
      ...CONTENT,
      sectionAbsences: [EXCLUSIONS_ABSENCE, {
        sectionId: 'identity',
        evidenceState: 'unavailable',
        reason: 'Nothing was found for identity.',
      }],
    })).toThrow(/identity/);

    // An absence for a section the clinician never selected would disclose the
    // shape of evidence outside the consented scope.
    expect(() => sealPacket({
      ...CONTENT,
      sectionAbsences: [EXCLUSIONS_ABSENCE, {
        sectionId: 'enrollment',
        evidenceState: 'unavailable',
        reason: 'Nothing was found for enrollment.',
      }],
    })).toThrow(/enrollment/);
  });

  it('absences are INSIDE the seal — changing one breaks replay', () => {
    const sealed = sealPacket(CONTENT);
    expect(verifySealedPacket(JSON.parse(JSON.stringify(sealed)))).toBe(true);

    // Softening the recorded reason after sealing must not verify. If absences
    // were computed at read time this tamper would be undetectable.
    const softened = {
      ...sealed,
      sectionAbsences: [{ ...EXCLUSIONS_ABSENCE, reason: 'Exclusions check completed.' }],
    };
    expect(verifySealedPacket(softened)).toBe(false);

    // Dropping the absence entirely — the original defect, applied post-seal.
    const { sectionAbsences: _dropped, ...withoutAbsences } = sealed;
    expect(verifySealedPacket(withoutAbsences as typeof sealed)).toBe(false);
  });

  it('an EMPTY absence list is a claim, and hashes differently from an omitted one', () => {
    // "Every selected section contributed evidence" and "absence was never
    // computed" are different facts, so they must be different bytes.
    const asserted = hashPacketContent({ ...CONTENT, selectedSections: ['identity'], sectionAbsences: [] });
    const legacy = hashPacketContent({ ...CONTENT, selectedSections: ['identity'], sectionAbsences: undefined });
    expect(asserted).not.toBe(legacy);
  });

  it('a legacy packet sealed before absences existed still replays', () => {
    // Legacy rows were written by code that had no absence concept, so they are
    // hashed directly here rather than through sealPacket's invariant.
    const legacyContent = { ...CONTENT, sectionAbsences: undefined };
    const legacySeal = { ...legacyContent, packetHash: hashPacketContent(legacyContent) };
    // Read-service reconstruction of a NULL column: undefined → key omitted.
    expect(verifySealedPacket({ ...legacySeal, sectionAbsences: undefined })).toBe(true);
    // Passing the NULL through naively would add a key the legacy hash never covered.
    expect(verifySealedPacket(
      { ...legacySeal, sectionAbsences: null } as unknown as typeof legacySeal,
    )).toBe(false);
  });
});

describe('buildSectionAbsencesFromTrustState', () => {
  const FIELDS = [FIELD];
  const SELECTION = ['identity', 'exclusions', 'licensure', 'enrollment'];

  it('names every selected section that produced no field, and no others', () => {
    const absences = buildSectionAbsencesFromTrustState({}, SELECTION, FIELDS);
    expect(absences.map((absence) => absence.sectionId)).toEqual([
      'enrollment',
      'exclusions',
      'licensure',
    ]);
  });

  it('never states, or implies, that an absent section came back clean', () => {
    const absences = buildSectionAbsencesFromTrustState(
      {
        licensureStatus: 'unknown',
        sourceCoverage: [
          { sourceId: 'OIG_LEIE', state: 'notFound', reason: 'OIG LEIE returned no record' },
          { sourceId: 'STATE_BOARD', state: 'gated', reason: 'State board requires credentialed access' },
          { sourceId: 'PECOS_PUBLIC', state: 'unavailable', reason: 'PECOS quarterly file unavailable' },
        ],
      },
      SELECTION,
      FIELDS,
    );

    for (const absence of absences) {
      // The vocabulary is shared with fields, minus every affirmative state.
      expect(['unavailable', 'access_required', 'needs_review']).toContain(absence.evidenceState);
      expect(absence.reason).toMatch(/nothing was found/i);
      expect(absence.reason).not.toMatch(/\bclear\b|\bclean\b|verified|no issues/i);
    }
  });

  it('distinguishes a gated route from a source that answered "no record"', () => {
    const byId = new Map(
      buildSectionAbsencesFromTrustState(
        {
          sourceCoverage: [
            { sourceId: 'STATE_BOARD', state: 'accessRequired', reason: 'Board access not held' },
            { sourceId: 'OIG_LEIE', state: 'notFound', reason: 'OIG LEIE returned no record' },
            { sourceId: 'PECOS_PUBLIC', state: 'pending', reason: 'PECOS not yet read' },
          ],
        },
        SELECTION,
        FIELDS,
      ).map((absence) => [absence.sectionId, absence]),
    );

    // Gated: we never read it.
    expect(byId.get('licensure')?.evidenceState).toBe('access_required');
    // Answered "no record" — a FINDING, so a human must see it, not a shrug.
    expect(byId.get('exclusions')?.evidenceState).toBe('needs_review');
    expect(byId.get('exclusions')?.reason).toMatch(/returned no record/i);
    // Not read yet.
    expect(byId.get('enrollment')?.evidenceState).toBe('unavailable');
  });

  it('flags the contradiction when trust state claims a section the packet lacks', () => {
    // The trust state says licensure is verified, yet no licensure field exists.
    // Silence here would be the worst case: an employer would infer a clean check
    // that the packet cannot substantiate.
    const [licensure] = buildSectionAbsencesFromTrustState(
      { licensureStatus: 'verified' },
      ['identity', 'licensure'],
      FIELDS,
    );
    expect(licensure.sectionId).toBe('licensure');
    expect(licensure.evidenceState).toBe('needs_review');
    expect(licensure.reason).toMatch(/disagree|unresolved/i);
  });

  it('makes no claim about source coverage it could not attribute', () => {
    // A dynamic licensure authority is not in the attribution table. The absence
    // must fall back to the conservative default rather than borrow another
    // section's words.
    const [licensure] = buildSectionAbsencesFromTrustState(
      { sourceCoverage: [{ sourceId: 'SOME_NEW_BOARD', state: 'gated', reason: 'Gated' }] },
      ['identity', 'licensure'],
      FIELDS,
    );
    expect(licensure.evidenceState).toBe('unavailable');
    expect(licensure.reason).not.toMatch(/gated|source note/i);
    expect(licensure.reason).toMatch(/nothing was found/i);
  });

  it('a section whose fields are all WITHHELD is not absent', () => {
    // Withheld fields stay in the packet with a null value, so the section is
    // represented. Calling it absent would erase the clinician's decision.
    const withheld: PacketFieldEntry = {
      ...FIELD,
      sectionId: 'licensure',
      fieldId: 'licensure.licensure.state_board',
      value: null,
      evidenceState: 'withheld',
    };
    const absences = buildSectionAbsencesFromTrustState({}, ['identity', 'licensure'], [FIELD, withheld]);
    expect(absences).toEqual([]);
  });
});
