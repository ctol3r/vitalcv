/**
 * Clinician activation — the canonical state model (Wave 1076 B1).
 *
 * Five states, deliberately separate and non-interchangeable. The whole point
 * of this module is that none of them may be inferred from another:
 *
 *   resolved           a registry returned information for an NPI.
 *                      It does NOT prove the current user owns that identity.
 *   profile_saved      the clinician reviewed it, confirmed sharing control,
 *                      and saved. Unlocks their own profile, discovery, and
 *                      clearly-labelled self-attested sharing.
 *                      It does NOT unlock private credential holdings.
 *   ownership_verified a separate process established identity control.
 *                      It is NOT the initial activation event, and it does NOT
 *                      mean any credential was verified.
 *   employer_reviewed  an employer opened the shared profile.
 *                      It does NOT mean approved, credentialed, privileged or
 *                      hired.
 *   ready_to_start     only when downstream employer-controlled conditions are
 *                      actually satisfied. NEVER inferred from the others.
 *
 * Every "does NOT" above is a lie the product could otherwise tell by accident,
 * which is why each is a test rather than a comment.
 */

/** Where a single field's value came from. Never collapsed into "verified". */
export type TruthClass =
  | 'public_source'      // a public registry returned it
  | 'clinician_provided' // the clinician typed or corrected it
  | 'ownership_verified' // identity control established (NOT credential proof)
  | 'employer_reviewed'; // an employer looked (NOT approval)

export const TRUTH_CLASSES: readonly TruthClass[] = [
  'public_source',
  'clinician_provided',
  'ownership_verified',
  'employer_reviewed',
];

/** Customer-facing wording. Friendly, but never merged into one badge. */
export const TRUTH_CLASS_LABEL: Record<TruthClass, string> = {
  public_source: 'From public sources',
  clinician_provided: 'You added this',
  ownership_verified: 'Identity confirmed',
  employer_reviewed: 'Seen by an employer',
};

export interface ProfileField {
  key: string;
  value: string;
  truthClass: TruthClass;
  /** For public_source, which registry answered. */
  source?: string;
}

export type ActivationState =
  | 'resolved'
  | 'profile_saved'
  | 'ownership_verified'
  | 'employer_reviewed'
  | 'ready_to_start';

export interface ActivationRecord {
  reviewedAt: Date | null;
  sharingConfirmedAt: Date | null;
  savedAt: Date | null;
  activatedAt: Date | null;
}

/**
 * The three conditions that constitute activation.
 *
 * A raw save is NOT activation: saving without review is data capture, and
 * reviewing without confirming sharing control is a preview. The founder
 * correction is explicit that `profile_saved` may not stand in as the
 * activation event or the denominator.
 */
export function isActivationComplete(r: ActivationRecord): boolean {
  return Boolean(r.reviewedAt && r.sharingConfirmedAt && r.savedAt);
}

/**
 * Should `clinician_profile_activated` be emitted right now?
 *
 * Exactly once per activation cycle: the conditions are met AND we have not
 * already stamped it. Repeated saves must not duplicate the event.
 */
export function shouldEmitActivation(r: ActivationRecord): boolean {
  return isActivationComplete(r) && r.activatedAt === null;
}

/**
 * The state a profile is in.
 *
 * Note what this function does NOT take: an ownership binding is passed
 * explicitly, never derived from the profile. Resolution and ownership are
 * different questions, and conflating them is the specific error the founder
 * decision forbids.
 */
export function activationState(
  r: ActivationRecord,
  opts: { ownershipVerified?: boolean; employerReviewed?: boolean; readyToStart?: boolean } = {},
): ActivationState {
  // Ready-to-start is only ever asserted by the caller from real downstream
  // conditions. It is never computed from anything below it.
  if (opts.readyToStart === true) return 'ready_to_start';
  if (opts.employerReviewed === true) return 'employer_reviewed';
  if (opts.ownershipVerified === true) return 'ownership_verified';
  if (isActivationComplete(r)) return 'profile_saved';
  return 'resolved';
}

/** What a state actually permits. Private holdings need ownership, not a save. */
export function permissions(state: ActivationState) {
  const saved = state !== 'resolved';
  const ownership = state === 'ownership_verified'
    || state === 'employer_reviewed'
    || state === 'ready_to_start';
  return {
    /** Their own reusable profile. */
    reusableProfile: saved,
    /** Opportunity discovery. */
    opportunityDiscovery: saved,
    /** Sharing, clearly labelled as self-attested where it is. */
    selfAttestedSharing: saved,
    /** Private credential holdings — ownership only, never a save. */
    privateCredentialHoldings: ownership,
  };
}

/**
 * The honest sentence for a state. No state may claim more than it is.
 */
export function stateDisclosure(state: ActivationState): string {
  switch (state) {
    case 'resolved':
      return 'Information found for this NPI. This does not confirm it is yours.';
    case 'profile_saved':
      return 'Your profile is saved and reusable. Details you added are your own statements, not independently checked.';
    case 'ownership_verified':
      return 'We confirmed this NPI is yours. This does not verify any individual credential.';
    case 'employer_reviewed':
      return 'An employer opened your profile. That is not approval, credentialing or a hiring decision.';
    case 'ready_to_start':
      return 'The employer has confirmed the conditions required to start.';
  }
}
