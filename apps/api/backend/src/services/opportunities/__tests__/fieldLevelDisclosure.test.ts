import {
  buildFieldEntriesFromTrustState,
  hashPacketContent,
  normalizeDisclosureSelection,
  sealPacket,
  verifySealedPacket,
  withheldFieldIdsOf,
  type ApplicationPacketContent,
  type DisclosureSelection,
} from '../applicationPacketService';

/**
 * Field-level disclosure, at the seam preview and sealing share.
 *
 * `buildFieldEntriesFromTrustState` is the ONE function both the seal path
 * (applicationService) and the current-evidence preview
 * (applicationPacketReadService) call. Anything that behaves differently
 * between them is a packet that does not match what the clinician approved.
 */

const trustState = {
  npi: '1720082779',
  facts: [
    {
      factType: 'IDENTITY',
      source: 'NPPES',
      status: 'VERIFIED',
      details: 'FRANCES BEN, MD',
      verifiedAt: '2026-08-01T00:00:00.000Z',
      expiresAt: null,
    },
    {
      factType: 'EXCLUSION',
      source: 'OIG_LEIE',
      status: 'VERIFIED',
      details: 'No exclusion record found',
      verifiedAt: '2026-07-01T00:00:00.000Z',
      expiresAt: '2026-09-01T00:00:00.000Z',
    },
  ],
} as unknown as Parameters<typeof buildFieldEntriesFromTrustState>[0];

const SECTIONS = ['identity', 'exclusions'];

function fieldIds(selection: DisclosureSelection | readonly string[]): string[] {
  return buildFieldEntriesFromTrustState(trustState, selection).map((f) => f.fieldId);
}

describe('a withheld field is present and marked, never omitted', () => {
  const all = fieldIds(SECTIONS);
  const target = all[0];

  it('keeps the same field set whether or not a field is withheld', () => {
    const withWithholding = fieldIds({ sections: SECTIONS, withheldFieldIds: [target] });
    // THE invariant. If withholding removed the entry, a reviewer could not
    // tell "not shared" from "no such evidence" — opposite facts.
    expect(withWithholding).toEqual(all);
  });

  it('nulls the value and marks the state, so the withholding is visible', () => {
    const entries = buildFieldEntriesFromTrustState(trustState, {
      sections: SECTIONS,
      withheldFieldIds: [target],
    });
    const withheld = entries.find((f) => f.fieldId === target)!;
    expect(withheld.evidenceState).toBe('withheld');
    expect(withheld.value).toBeNull();
    // The label and section survive — the reviewer knows WHAT was withheld.
    expect(withheld.label).toBeTruthy();
    expect(withheld.sectionId).toBeTruthy();
  });

  it('suppresses provenance with the value, not just the value', () => {
    const entries = buildFieldEntriesFromTrustState(trustState, {
      sections: SECTIONS,
      withheldFieldIds: [target],
    });
    const withheld = entries.find((f) => f.fieldId === target)!;
    // Leaving the observation time / freshness horizon would leak the shape of
    // the evidence the clinician declined to share.
    expect(withheld.sourceObservedAt).toBeNull();
    expect(withheld.freshUntil).toBeNull();
  });

  it('leaves every non-withheld field untouched', () => {
    const entries = buildFieldEntriesFromTrustState(trustState, {
      sections: SECTIONS,
      withheldFieldIds: [target],
    });
    for (const entry of entries.filter((f) => f.fieldId !== target)) {
      expect(entry.evidenceState).not.toBe('withheld');
      expect(entry.value).not.toBeNull();
    }
  });
});

describe('preview and seal consume the same selection object', () => {
  it('produces byte-identical entries for the same selection', () => {
    const selection: DisclosureSelection = {
      sections: SECTIONS,
      withheldFieldIds: [fieldIds(SECTIONS)[0]],
    };
    // The preview call and the seal call, as the two services make them.
    const preview = buildFieldEntriesFromTrustState(trustState, selection);
    const sealed = buildFieldEntriesFromTrustState(trustState, selection);
    expect(JSON.stringify(sealed)).toBe(JSON.stringify(preview));
  });

  it('canonicalizes equivalent selections identically (order, duplicates)', () => {
    const a = normalizeDisclosureSelection({
      sections: ['exclusions', 'identity'],
      withheldFieldIds: ['b', 'a', 'b'],
    });
    const b = normalizeDisclosureSelection({
      sections: ['identity', 'exclusions'],
      withheldFieldIds: ['a', 'b'],
    });
    expect(a).toEqual(b);
  });
});

describe('the seal hash covers the withholding', () => {
  function contentWith(selection: DisclosureSelection | readonly string[]): ApplicationPacketContent {
    return {
      applicationId: 'app-1',
      packetVersion: 1,
      clerkUserId: 'user_1',
      clinicianNpi: '1720082779',
      opportunityId: 'opp-1',
      employerOrgId: 'org-1',
      purpose: 'application',
      recipient: 'Mercy General',
      selectedSections: normalizeDisclosureSelection(selection).sections,
      fields: buildFieldEntriesFromTrustState(trustState, selection),
      clinicianNote: null,
      methodologyVersion: 'v1',
      consentAt: '2026-08-02T00:00:00.000Z',
      consentReceiptId: 'receipt-1',
    };
  }

  it('changes the hash when a field is withheld', () => {
    const open = hashPacketContent(contentWith(SECTIONS));
    const withheld = hashPacketContent(
      contentWith({ sections: SECTIONS, withheldFieldIds: [fieldIds(SECTIONS)[0]] }),
    );
    // Withholding is part of the sealed artifact, not a presentation choice.
    expect(withheld).not.toBe(open);
  });

  it('seals and re-verifies a packet containing withheld fields', () => {
    const sealed = sealPacket(
      contentWith({ sections: SECTIONS, withheldFieldIds: [fieldIds(SECTIONS)[0]] }),
    );
    expect(verifySealedPacket(sealed)).toBe(true);
  });

  /**
   * The compatibility invariant. A packet with nothing withheld must hash
   * EXACTLY as it did before field-level disclosure existed, or every packet
   * already sealed in production stops verifying — and an unverifiable
   * historical packet is indistinguishable from a tampered one.
   */
  it('does not change the hash of a packet that withholds nothing', () => {
    const legacyShape = hashPacketContent(contentWith(SECTIONS));
    const newShapeNothingWithheld = hashPacketContent(
      contentWith({ sections: SECTIONS, withheldFieldIds: [] }),
    );
    expect(newShapeNothingWithheld).toBe(legacyShape);
  });

  it('accepts the legacy positional section array unchanged', () => {
    const positional = hashPacketContent(contentWith(SECTIONS));
    const objectForm = hashPacketContent(contentWith({ sections: SECTIONS }));
    expect(objectForm).toBe(positional);
  });
});

describe('withheldFieldIdsOf derives from the packet, not a parallel list', () => {
  it('recovers exactly the withheld ids', () => {
    const target = fieldIds(SECTIONS)[0];
    const fields = buildFieldEntriesFromTrustState(trustState, {
      sections: SECTIONS,
      withheldFieldIds: [target],
    });
    expect(withheldFieldIdsOf({ fields })).toEqual([target]);
  });

  it('returns empty for a packet that withheld nothing', () => {
    expect(withheldFieldIdsOf({ fields: buildFieldEntriesFromTrustState(trustState, SECTIONS) }))
      .toEqual([]);
  });
});
