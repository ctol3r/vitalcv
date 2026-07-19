import {
  evaluatePacketAcceptance,
  type PacketAcceptanceExpectation,
  type StoredPacketSnapshot,
} from '../packetAcceptanceGuard';

function packet(overrides: Partial<StoredPacketSnapshot> = {}): StoredPacketSnapshot {
  return {
    applicationId: 'app_1',
    packetHash: 'sha256:abc',
    packetVersion: 2,
    opportunityVersion: 'v3',
    clinicianNpi: '1234567890',
    employerOrgId: 'org_good_health',
    revokedAt: null,
    supersededByPacketId: null,
    ...overrides,
  };
}

function expectation(
  overrides: Partial<PacketAcceptanceExpectation> = {},
): PacketAcceptanceExpectation {
  return {
    clinicianNpi: '1234567890',
    employerOrgId: 'org_good_health',
    ...overrides,
  };
}

describe('evaluatePacketAcceptance — fail closed', () => {
  it('accepts when the claimed hash matches the live packet for the expected subject', () => {
    const v = evaluatePacketAcceptance('sha256:abc', packet(), expectation());
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.packetHash).toBe('sha256:abc');
      expect(v.packetVersion).toBe(2);
      expect(v.opportunityVersion).toBe('v3');
    }
  });

  it('accepts an unscoped review (no reviewer org modeled) when the subject matches', () => {
    const v = evaluatePacketAcceptance('sha256:abc', packet(), expectation({ employerOrgId: null }));
    expect(v.ok).toBe(true);
  });

  it('fails closed when no packet exists for the application', () => {
    expect(evaluatePacketAcceptance('sha256:abc', null, expectation()))
      .toEqual({ ok: false, reason: 'packet_not_found' });
  });

  it('fails closed when the packet belongs to a different clinician than the one under review', () => {
    const v = evaluatePacketAcceptance(
      'sha256:abc',
      packet({ clinicianNpi: '9999999999' }),
      expectation(),
    );
    expect(v).toEqual({ ok: false, reason: 'packet_subject_mismatch' });
  });

  it('fails closed on an empty expected NPI — a caller can never skip the subject check', () => {
    const v = evaluatePacketAcceptance('sha256:abc', packet(), expectation({ clinicianNpi: '' }));
    expect(v).toEqual({ ok: false, reason: 'packet_subject_mismatch' });
  });

  it("fails closed when the packet was sealed for a different employer org than the reviewer's", () => {
    const v = evaluatePacketAcceptance(
      'sha256:abc',
      packet({ employerOrgId: 'org_other_tenant' }),
      expectation(),
    );
    expect(v).toEqual({ ok: false, reason: 'packet_org_mismatch' });
  });

  it('checks subject binding before revocation — a foreign packet leaks no lifecycle state', () => {
    const v = evaluatePacketAcceptance(
      'sha256:abc',
      packet({ clinicianNpi: '9999999999', revokedAt: '2026-05-01T00:00:00.000Z' }),
      expectation(),
    );
    expect(v).toEqual({ ok: false, reason: 'packet_subject_mismatch' });
  });

  it('checks subject binding before hash state — a foreign packet leaks no content match', () => {
    const v = evaluatePacketAcceptance(
      'sha256:GUESS',
      packet({ clinicianNpi: '9999999999' }),
      expectation(),
    );
    expect(v).toEqual({ ok: false, reason: 'packet_subject_mismatch' });
  });

  it('fails closed when the packet has been revoked (even if the hash matches)', () => {
    const v = evaluatePacketAcceptance(
      'sha256:abc',
      packet({ revokedAt: '2026-05-01T00:00:00.000Z' }),
      expectation(),
    );
    expect(v).toEqual({ ok: false, reason: 'packet_revoked' });
  });

  it('fails closed when the claimed hash does not match (packet changed under the reviewer)', () => {
    const v = evaluatePacketAcceptance('sha256:STALE', packet(), expectation());
    expect(v).toEqual({ ok: false, reason: 'packet_integrity_mismatch' });
  });

  it('fails closed on an empty claimed hash', () => {
    expect(evaluatePacketAcceptance('', packet(), expectation()))
      .toEqual({ ok: false, reason: 'packet_integrity_mismatch' });
  });

  it('checks revocation before hash — a revoked packet is never acceptable', () => {
    // Revoked takes precedence: even a matching hash cannot accept a revoked packet.
    const v = evaluatePacketAcceptance(
      'sha256:abc',
      packet({ revokedAt: '2026-05-01T00:00:00.000Z' }),
      expectation(),
    );
    expect(v).toEqual({ ok: false, reason: 'packet_revoked' });
  });
});
