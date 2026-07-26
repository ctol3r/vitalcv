/**
 * identityGate — route-level enforcement of derived clinician-identity tiers.
 *
 * Wraps the pure identityTier derivation with the profile lookup and the
 * honest 403. Used by the clinician-only powers: publishing the public career
 * profile, applying to openings, and the AI matching/drafting features.
 */

import prisma from '../../graphql/prisma_client';
import { HttpError } from '../../utils/httpError';
import {
  deriveIdentityState,
  tierAtLeast,
  tierRequirementMessage,
  type IdentityState,
  type IdentityTier,
} from './identityTier';

/** Identity state for an internal User.id (never a raw Clerk id). */
export async function identityStateForUser(userId: string): Promise<IdentityState> {
  const profile = await prisma.personProfile.findFirst({
    where: { userId },
    select: { npi: true, verifiedEmail: true, profession: true },
  });
  return deriveIdentityState(profile);
}

/**
 * Throws an honest 403 when the user's derived tier is below `min`.
 * Returns the state so callers can log or enrich responses.
 */
export async function requireIdentityTier(
  userId: string,
  min: IdentityTier,
): Promise<IdentityState> {
  const state = await identityStateForUser(userId);
  if (!tierAtLeast(state.tier, min)) {
    throw new HttpError(403, tierRequirementMessage(min));
  }
  return state;
}
