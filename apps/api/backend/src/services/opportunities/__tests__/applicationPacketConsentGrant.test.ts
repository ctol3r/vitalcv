import {
  hashPacketContent,
  sealPacket,
  verifySealedPacket,
  type ApplicationPacketContent,
} from '../applicationPacketService';

const BASE: ApplicationPacketContent = {
  applicationId: '4b6f0000-0000-4000-8000-000000000001',
  packetVersion: 1,
  clerkUserId: 'user_packet_grant',
  clinicianNpi: '1558302470',
  opportunityId: '4b6f0000-0000-4000-8000-000000000002',
  employerOrgId: '4b6f0000-0000-4000-8000-000000000003',
  purpose: 'application',
  recipient: 'Example Health System',
  selectedSections: ['identity'],
  fields: [{
    sectionId: 'identity',
    fieldId: 'identity.npi.nppes',
    label: 'NPI',
    value: '1558302470',
    evidenceState: 'source_backed',
    sourceId: 'nppes',
    sourceObservedAt: '2026-07-30T12:00:00.000Z',
    freshUntil: null,
    artifactId: 'artifact-1',
    receiptId: 'receipt-1',
  }],
  clinicianNote: null,
  methodologyVersion: 'phase1',
  consentAt: '2026-07-30T12:05:00.000Z',
  consentReceiptId: '4b6f0000-0000-4000-8000-000000000004',
  opportunityVersion: '2026-07-30T12:00:00.000Z',
};

const GRANT_ID = '4b6f0000-0000-4000-8000-000000000005';

describe('ApplicationPacket consentGrantId replay contract', () => {
  it('keeps legacy bytes identical when the new key is omitted or undefined', () => {
    expect(hashPacketContent({ ...BASE, consentGrantId: undefined })).toBe(hashPacketContent(BASE));

    const legacy = sealPacket(BASE);
    expect(verifySealedPacket({ ...legacy, consentGrantId: undefined })).toBe(true);
  });

  it('covers consentGrantId in the seal for new packets', () => {
    const withGrant = { ...BASE, consentGrantId: GRANT_ID };
    expect(hashPacketContent(withGrant)).not.toBe(hashPacketContent(BASE));
    expect(verifySealedPacket(sealPacket(withGrant))).toBe(true);
  });

  it('fails replay if a stored first-class grant binding is changed', () => {
    const sealed = sealPacket({ ...BASE, consentGrantId: GRANT_ID });
    expect(verifySealedPacket({
      ...sealed,
      consentGrantId: '4b6f0000-0000-4000-8000-000000000006',
    })).toBe(false);
  });

  it('documents why database null must reconstruct as undefined', () => {
    const sealed = sealPacket(BASE);
    const naiveNull = { ...sealed, consentGrantId: null } as unknown as typeof sealed;
    expect(verifySealedPacket(naiveNull)).toBe(false);
  });
});
