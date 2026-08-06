/**
 * Missing-field guidance — Wave 1076 B1.
 *
 * The instruction this exists to satisfy: **the UI must not merely mark a field
 * red.** For every missing required field a clinician should be told what is
 * missing, why VitalCV needs it, and what future action it supports —
 *
 *   "Add a contact email so an employer can respond when you choose to share
 *    this profile."
 *
 * — not "Contact email is required."
 *
 * The server field registry stays canonical. Which fields exist, which are
 * required, and what each one supports all arrive in `fieldSpecs` on the
 * response; this module only chooses the words. That split matters: a UI that
 * kept its own list of fields would keep showing a field the server had
 * dropped, or silently stop asking for one the server had added.
 *
 * Hence the fallback. A field the server declares but this module has no
 * sentence for still produces real guidance, composed from the registry's own
 * `label` and `supports`. A new required field can therefore ship on the server
 * alone and the surface degrades to the server's wording rather than to
 * nothing.
 */

import type { ProfileFieldSpec, ProfileView } from './profileView';
import { fieldSpec } from './profileView';

export interface FieldGuidance {
  key: string;
  /** The field's name, as the clinician sees it. */
  label: string;
  /** What to do, in the imperative. */
  ask: string;
  /** Why VitalCV needs it and what it unlocks later. */
  why: string;
}

/**
 * Hand-written guidance, keyed by field.
 *
 * Every sentence names a future action the value supports — an employer
 * replying, a role matching, a profile arriving legible. None of them describe
 * the database, and none of them promise anything the product does not do.
 */
const GUIDANCE: Record<string, { ask: string; why: string }> = {
  fullName: {
    ask: 'Add the name you work under',
    why: 'An employer receiving your profile needs to know whose it is. If the registry has an older name, correct it here — the change travels with the profile.',
  },
  credential: {
    ask: 'Add your credential',
    why: 'MD, DO, NP, PA-C — this is the first thing an employer filters on, and roles that need it will not match a profile that does not state it.',
  },
  specialty: {
    ask: 'Add your specialty',
    why: 'Specialty is what opportunity matching reads first. Without it, VitalCV can only guess which roles are worth showing you.',
  },
  practiceState: {
    ask: 'Add where you practice',
    why: 'Roles are posted by location. This is what lets VitalCV show you the ones you could actually take.',
  },
  contactEmail: {
    ask: 'Add a contact email',
    why: 'So an employer can respond when you choose to share this profile. Without a reply path, a shared profile reaches someone who cannot answer it.',
  },
  licensedStates: {
    ask: 'Add the states you are licensed in',
    why: 'Every state you add widens the roles that can match you — and you stop re-entering the list on every application.',
  },
  preferredStates: {
    ask: 'Add where you want to work',
    why: 'No public source knows this. Telling VitalCV once is the difference between relevant roles and every role.',
  },
  workArrangement: {
    ask: 'Add the work arrangement you want',
    why: 'Full-time, part-time, locums, per diem, or an additional role — matching uses it to stop showing you the shape of job you are not looking for.',
  },
};

/**
 * Guidance for one field.
 *
 * The fallback composes the registry's own words rather than inventing any: a
 * field this module has never heard of still explains itself.
 */
export function guidanceForSpec(spec: ProfileFieldSpec): FieldGuidance {
  const written = GUIDANCE[spec.key];
  return {
    key: spec.key,
    label: spec.label,
    ask: written?.ask ?? `Add ${spec.label.toLowerCase()}`,
    why: written?.why ?? spec.supports,
  };
}

/**
 * Guidance for every required field the server says is still missing.
 *
 * Driven by `view.missingRequired` — the server's answer, in the server's
 * order. The surface never decides for itself whether a profile is complete;
 * that decision belongs to the same code that refuses an incomplete save, so
 * the two can never disagree.
 */
export function missingFieldGuidance(view: ProfileView): FieldGuidance[] {
  return view.missingRequired
    .map((key) => {
      const spec = fieldSpec(view, key);
      return spec
        ? guidanceForSpec(spec)
        : // A key with no spec should not happen — both come from the same
          // registry in the same response. If it ever does, say the true thing
          // (this field is needed) rather than dropping it silently.
          { key, label: key, ask: `Add ${key}`, why: 'This is needed before the profile can be saved for reuse.' };
    })
    .filter(Boolean);
}
