/**
 * Organization Federation (Wave 800, C5)
 * ──────────────────────────────────────────────────────────────────────────
 * A federation is the trust boundary across which evidence exchanges are
 * accepted: a set of member organizations that share a verification secret.
 * Membership decides *who may transmit* — it never decides *how trustworthy the
 * evidence is*. Trust is still re-derived per-exchange by the verifier
 * (`evaluateExchange`); the federation only answers "is this sender one of us?".
 *
 * Pure, in-memory model. Real key custody / rotation is an external concern
 * (per-member secrets, KMS); this layer is deliberately honest about that and
 * does not pretend to manage keys.
 */

export interface FederationMember {
  /** Stable org key used as the exchange `issuer`. */
  orgKey: string;
  /** Display name. */
  name: string;
  /** What this member is permitted to do within the federation. */
  roles: FederationRole[];
}

export type FederationRole = 'issuer' | 'verifier';

export interface FederationRegistry {
  federationId: string;
  members: FederationMember[];
}

/** Look up a member by org key (exact match). */
export function findMember(registry: FederationRegistry, orgKey: string): FederationMember | null {
  const key = orgKey?.trim();
  if (!key) return null;
  return registry.members.find((m) => m.orgKey === key) ?? null;
}

/** Is this org a federation member at all? */
export function isFederationMember(registry: FederationRegistry, orgKey: string): boolean {
  return findMember(registry, orgKey) !== null;
}

/** May this org perform the given role within the federation? */
export function memberCanActAs(
  registry: FederationRegistry,
  orgKey: string,
  role: FederationRole,
): boolean {
  const member = findMember(registry, orgKey);
  return member !== null && member.roles.includes(role);
}

/**
 * Gate an inbound exchange at the federation boundary BEFORE any trust work.
 * Fails closed: a non-member, or a member lacking the `issuer` role, is refused.
 * (Signature integrity is checked separately in `evaluateExchange`; this is the
 * membership/authorization layer, not the crypto layer.)
 */
export function authorizeIssuer(
  registry: FederationRegistry,
  issuerKey: string,
): { authorized: boolean; reason: string } {
  if (!isFederationMember(registry, issuerKey)) {
    return { authorized: false, reason: `Issuer "${issuerKey}" is not a member of federation ${registry.federationId}.` };
  }
  if (!memberCanActAs(registry, issuerKey, 'issuer')) {
    return { authorized: false, reason: `Member "${issuerKey}" is not authorized to issue exchanges.` };
  }
  return { authorized: true, reason: 'Issuer is an authorized federation member.' };
}
