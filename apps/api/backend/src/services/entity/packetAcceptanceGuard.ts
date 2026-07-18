/**
 * ACT-1.2 — pure fail-closed guard for linking an employer acceptance to a
 * specific sealed application packet.
 *
 * When a reviewer accepts BY application (passing an applicationId + the
 * packetHash they reviewed), the acceptance must not be recorded unless the
 * hash still matches the current sealed packet and that packet is live. This
 * keeps an acceptance honestly traceable to exactly the evidence that was
 * reviewed — a reviewer can never accept a packet that was revoked or has
 * silently changed under them.
 *
 * Pure: takes the claimed hash and the stored packet snapshot, returns a
 * verdict. No I/O — the caller resolves the packet and reacts to the verdict.
 */

export interface StoredPacketSnapshot {
  readonly applicationId: string;
  readonly packetHash: string;
  readonly packetVersion: number;
  readonly opportunityVersion: string | null;
  /** Set when the packet has been revoked (must not be accepted). */
  readonly revokedAt: string | null;
  /** Set when a newer packet supersedes this one. */
  readonly supersededByPacketId: string | null;
}

export type PacketAcceptanceVerdict =
  | { readonly ok: true; readonly packetHash: string; readonly packetVersion: number; readonly opportunityVersion: string | null }
  | { readonly ok: false; readonly reason: 'packet_not_found' | 'packet_integrity_mismatch' | 'packet_revoked' };

/**
 * @param claimedHash the packetHash the reviewer says they reviewed
 * @param stored the current sealed packet for that application, or null if none
 */
export function evaluatePacketAcceptance(
  claimedHash: string,
  stored: StoredPacketSnapshot | null,
): PacketAcceptanceVerdict {
  if (!stored) return { ok: false, reason: 'packet_not_found' };
  if (stored.revokedAt != null) return { ok: false, reason: 'packet_revoked' };
  // Constant-time-ish exact match; the hash is a content seal, so any
  // difference (including a supersession that changed the hash) fails closed.
  if (claimedHash.length === 0 || claimedHash !== stored.packetHash) {
    return { ok: false, reason: 'packet_integrity_mismatch' };
  }
  return {
    ok: true,
    packetHash: stored.packetHash,
    packetVersion: stored.packetVersion,
    opportunityVersion: stored.opportunityVersion,
  };
}
