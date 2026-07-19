/**
 * ACT-1.2 — pure fail-closed guard for linking an employer acceptance to a
 * specific sealed application packet.
 *
 * When a reviewer accepts BY application (passing an applicationId + the
 * packetHash they reviewed), the acceptance must not be recorded unless the
 * packet is actually about the clinician under review, belongs to the org the
 * reviewer is acting for (when that org is known), still matches the reviewed
 * hash, and is live. This keeps an acceptance honestly traceable to exactly
 * the evidence that was reviewed — a reviewer can never accept a packet that
 * was revoked, has silently changed under them, or belongs to another
 * clinician or tenant.
 *
 * Check order is deliberate: subject/org binding is verified BEFORE
 * revocation or hash state, so a caller probing a foreign applicationId
 * learns nothing about that packet's lifecycle or content.
 *
 * Pure: takes the claimed hash, the stored packet snapshot, and the caller's
 * expected subject, returns a verdict. No I/O — the caller resolves the
 * packet and reacts to the verdict.
 */

export interface StoredPacketSnapshot {
  readonly applicationId: string;
  readonly packetHash: string;
  readonly packetVersion: number;
  readonly opportunityVersion: string | null;
  /** Subject binding frozen at seal — the clinician this packet discloses. */
  readonly clinicianNpi: string;
  /** Tenant binding frozen at seal — the org whose opportunity was applied to. */
  readonly employerOrgId: string;
  /** Set when the packet has been revoked (must not be accepted). */
  readonly revokedAt: string | null;
  /** Set when a newer packet supersedes this one. */
  readonly supersededByPacketId: string | null;
}

/**
 * Who the acceptance is being recorded for. Required — every caller must
 * state the subject it is accepting so a packet reference can never be
 * attached across clinicians or tenants.
 */
export interface PacketAcceptanceExpectation {
  /** NPI of the entity under review — the only clinician this acceptance may bind to. */
  readonly clinicianNpi: string;
  /**
   * The org the reviewer is acting for (resolved from the persisted review
   * context), or null when the accept is unscoped and no reviewer org is
   * modeled. The org check only runs when an org is known — the subject
   * check always runs.
   */
  readonly employerOrgId: string | null;
}

export type PacketAcceptanceVerdict =
  | { readonly ok: true; readonly packetHash: string; readonly packetVersion: number; readonly opportunityVersion: string | null }
  | {
      readonly ok: false;
      readonly reason:
        | 'packet_not_found'
        | 'packet_subject_mismatch'
        | 'packet_org_mismatch'
        | 'packet_integrity_mismatch'
        | 'packet_revoked';
    };

/**
 * @param claimedHash the packetHash the reviewer says they reviewed
 * @param stored the current sealed packet for that application, or null if none
 * @param expected the clinician (and org, when modeled) this acceptance is for
 */
export function evaluatePacketAcceptance(
  claimedHash: string,
  stored: StoredPacketSnapshot | null,
  expected: PacketAcceptanceExpectation,
): PacketAcceptanceVerdict {
  if (!stored) return { ok: false, reason: 'packet_not_found' };
  // Subject binding first: a packet about a different clinician fails before
  // anything about its lifecycle or content is disclosed. An empty expected
  // NPI can never match — fail closed.
  if (!expected.clinicianNpi || stored.clinicianNpi !== expected.clinicianNpi) {
    return { ok: false, reason: 'packet_subject_mismatch' };
  }
  // Tenant binding, enforced when the reviewer's org is modeled: the packet
  // was sealed for exactly one employer org and may only be accepted under it.
  if (expected.employerOrgId != null && stored.employerOrgId !== expected.employerOrgId) {
    return { ok: false, reason: 'packet_org_mismatch' };
  }
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
