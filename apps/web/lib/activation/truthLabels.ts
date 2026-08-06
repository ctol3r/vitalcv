/**
 * Truth labels for the review surface — Wave 1076 B1.
 *
 * Four truth classes exist on the server and they may not collapse into one
 * badge. This module is where the customer-facing words for them live, and it
 * has exactly one rule it must never break: **no label may be, or reduce to,
 * the bare word "Verified"**. A public registry answering for an NPI is not
 * verification of the person; a clinician typing a value is not verification of
 * the value; and an employer opening a profile is not approval of it. One badge
 * saying "Verified" over all four would be the single most efficient lie the
 * product could tell.
 *
 * The wording is deliberately plain — "Found in NPPES", "Added or changed by
 * you" — rather than the internal vocabulary. A clinician should be able to
 * tell where a value came from without learning what a truth class is.
 */

import type { TruthClass } from './profileView';

export interface TruthLabel {
  /** The badge text. */
  label: string;
  /** One sentence saying what the label does and does not mean. */
  meaning: string;
}

const DEFAULT_PUBLIC_SOURCE = 'a public source';

/**
 * The label for a value, given its truth class and (for public values) the
 * registry that answered.
 *
 * `source` names the registry when the server recorded one — "Found in NPPES"
 * is more useful and more honest than "From a public source", because it says
 * which public source, and a clinician who disagrees knows where to go.
 */
export function truthLabel(truthClass: TruthClass, source?: string): TruthLabel {
  switch (truthClass) {
    case 'public_source':
      return {
        label: source ? `Found in ${source}` : 'Found in a public source',
        meaning: `This came from ${
          source ?? DEFAULT_PUBLIC_SOURCE
        }. It is public information about the NPI, not confirmation that the NPI is yours. You can correct it.`,
      };
    case 'clinician_provided':
      return {
        label: 'Added or changed by you',
        meaning:
          'This is your own statement. VitalCV has not checked it against a source, and says so wherever it is shared.',
      };
    case 'ownership_verified':
      return {
        label: 'Identity confirmed',
        meaning:
          'We confirmed this NPI belongs to you. That is about your identity — it does not check any individual credential.',
      };
    case 'employer_reviewed':
      return {
        label: 'Seen by an employer',
        meaning:
          'An employer opened this. Opening it is not approval, credentialing, or a hiring decision.',
      };
  }
}

/**
 * What the badge becomes once the clinician edits a public-source value.
 *
 * The displayed value becomes theirs the moment they change it — but the
 * original public observation is not destroyed, it stays on the server. This
 * sentence is how the surface says that without teaching anyone the word
 * "snapshot".
 */
export function editedFromPublicSourceNote(source?: string): string {
  return `You changed this, so it now shows as yours. What ${
    source ?? DEFAULT_PUBLIC_SOURCE
  } originally returned is kept, unchanged, on your profile record.`;
}
