import { evaluatePacketAcceptance, type StoredPacketSnapshot } from '../packetAcceptanceGuard';

function packet(overrides: Partial<StoredPacketSnapshot> = {}): StoredPacketSnapshot {
  return {
    applicationId: 'app_1',
    packetHash: 'sha256:abc',
    packetVersion: 2,
    opportunityVersion: 'v3',
    revokedAt: null,
    supersededByPacketId: null,
    ...overrides,
  };
}

describe('evaluatePacketAcceptance — fail closed', () => {
  it('accepts when the claimed hash matches the live packet', () => {
    const v = evaluatePacketAcceptance('sha256:abc', packet());
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.packetHash).toBe('sha256:abc');
      expect(v.packetVersion).toBe(2);
      expect(v.opportunityVersion).toBe('v3');
    }
  });

  it('fails closed when no packet exists for the application', () => {
    expect(evaluatePacketAcceptance('sha256:abc', null)).toEqual({ ok: false, reason: 'packet_not_found' });
  });

  it('fails closed when the packet has been revoked (even if the hash matches)', () => {
    const v = evaluatePacketAcceptance('sha256:abc', packet({ revokedAt: '2026-05-01T00:00:00.000Z' }));
    expect(v).toEqual({ ok: false, reason: 'packet_revoked' });
  });

  it('fails closed when the claimed hash does not match (packet changed under the reviewer)', () => {
    const v = evaluatePacketAcceptance('sha256:STALE', packet());
    expect(v).toEqual({ ok: false, reason: 'packet_integrity_mismatch' });
  });

  it('fails closed on an empty claimed hash', () => {
    expect(evaluatePacketAcceptance('', packet())).toEqual({ ok: false, reason: 'packet_integrity_mismatch' });
  });

  it('checks revocation before hash — a revoked packet is never acceptable', () => {
    // Revoked takes precedence: even a matching hash cannot accept a revoked packet.
    const v = evaluatePacketAcceptance('sha256:abc', packet({ revokedAt: '2026-05-01T00:00:00.000Z' }));
    expect(v).toEqual({ ok: false, reason: 'packet_revoked' });
  });
});
