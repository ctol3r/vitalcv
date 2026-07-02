/**
 * WAVE-2G — clinician identity surface model.
 *
 * Pure transform: no fetches, no DB access, no audit writes. Takes the
 * account-session facts (Clerk via RoleContext) and the stored
 * PersonProfile (GET /api/me/workspaces) and derives a provenance-honest
 * model of the identity VitalCV holds: what each value is, where it came
 * from, what is missing, what the clinician can change, and what must be
 * corrected at the source of record instead.
 *
 * Truth invariants:
 *   1. Reuses the 5-tier provenance vocabulary (lib/profile/provenance)
 *      plus the confidence axis (lib/clinician-profile/profileTypes).
 *      No new identity vocabulary is introduced.
 *   2. Binding readiness comes from evaluateClinicianNpiBindingReadiness.
 *      Its ceiling is `foundation_ready`; nothing here may present a
 *      binding as identity-proofed.
 *   3. PersonProfile identity fields (name, specialty, state) are only
 *      written by the NPI claim flow today, which copies them from
 *      NPPES. They are therefore labeled source-backed *stored copies*
 *      when an NPI is bound — with an explicit limitation note — and
 *      self-attested otherwise. If a profile edit path ships later, the
 *      writer must pass real per-field provenance instead.
 *   4. No field may carry the bare status label "Verified".
 */

import {
  evaluateClinicianNpiBindingReadiness,
  type ClinicianNpiBindingStatus,
} from '@/lib/identity/identityProofingPolicy';
import {
  isCoherentProvenance,
  type ProfileFieldConfidence,
} from '@/lib/clinician-profile/profileTypes';
import type { ProfileProvenance } from '@/lib/profile/provenance';
import type { WorkspacePersonProfile } from '@/types/workspace';

/** How (or whether) the clinician can change a given identity value. */
export type IdentityChangePolicy =
  | 'editable_profile'
  | 'account_managed'
  | 'source_of_record'
  | 'not_editable';

export interface IdentitySurfaceField {
  id: string;
  label: string;
  /** Display value; null means nothing is on file. */
  value: string | null;
  provenance: ProfileProvenance;
  confidence: ProfileFieldConfidence;
  /** Where the stored value came from (plain language, no overclaim). */
  sourceLabel: string;
  changePolicy: IdentityChangePolicy;
  /** One line: how to change this value, or why it cannot be changed here. */
  changeNote: string;
  /** Optional honesty caveat rendered next to the source label. */
  limitationNote?: string;
}

export interface IdentitySurfaceSection {
  id: 'account' | 'npi_binding' | 'profile_identity';
  title: string;
  /** Plain-language framing for the section; never claims proofing. */
  summary: string;
  fields: IdentitySurfaceField[];
}

export interface IdentitySurfaceGap {
  id: 'sign_in' | 'claim_npi' | 'name_missing' | 'profile_fields';
  label: string;
  description: string;
  href: string;
  cta: string;
}

export interface ClinicianIdentitySurfaceModel {
  audience: 'signed_out' | 'signed_in';
  bindingStatus: ClinicianNpiBindingStatus;
  bindingExplanation: string;
  sections: IdentitySurfaceSection[];
  gaps: IdentitySurfaceGap[];
}

export interface ClinicianIdentitySurfaceInput {
  isSignedIn: boolean;
  /** Primary email from the sign-in provider, when the caller has it. */
  accountEmail: string | null;
  personProfile: WorkspacePersonProfile | null;
}

const STORED_COPY_NOTE =
  'Stored copy from your NPI claim. Live source freshness appears in your readiness snapshot.';

/**
 * Plain-language explanation for each binding status. The strongest
 * status is explained as a self-attested link — never as proofing.
 */
export function explainNpiBindingStatus(status: ClinicianNpiBindingStatus): string {
  switch (status) {
    case 'unbound':
      return 'No NPI is linked to this account. Claiming your NPI resolves it against NPPES and creates the link.';
    case 'self_attested':
      return 'An NPI is on file but no name record accompanies it, so the link rests on the claim alone.';
    case 'foundation_ready':
      return 'Your NPI was resolved against NPPES and you attested it is yours. This is a self-attested link — NPI lookup is not government-ID identity proofing, and foundation_ready is the strongest status this surface reports.';
    case 'gov_id_required':
      return 'This link needs government-ID proofing, which is a planned control and not live in this build.';
    case 'liveness_required':
      return 'This link needs a liveness check, which is a planned control and not live in this build.';
    case 'unavailable':
      return 'Binding evaluation is unavailable in this environment.';
  }
}

interface FieldSpec {
  id: string;
  label: string;
  value: string | null;
  provenance: ProfileProvenance;
  confidence: ProfileFieldConfidence;
  sourceLabel: string;
  changePolicy: IdentityChangePolicy;
  changeNote: string;
  limitationNote?: string;
}

/**
 * Normalizes a field so missing values are honestly UNKNOWN/unverified
 * and the provenance–confidence pair is always coherent, regardless of
 * what the caller claimed.
 */
function buildField(spec: FieldSpec): IdentitySurfaceField {
  const missing = spec.value === null || spec.value.trim().length === 0;
  const provenance: ProfileProvenance = missing ? 'UNKNOWN' : spec.provenance;
  let confidence: ProfileFieldConfidence = missing ? 'unverified' : spec.confidence;
  if (!isCoherentProvenance(provenance, confidence)) {
    confidence = 'unverified';
  }

  return {
    id: spec.id,
    label: spec.label,
    value: missing ? null : spec.value,
    provenance,
    confidence,
    sourceLabel: missing ? 'No data on file' : spec.sourceLabel,
    changePolicy: spec.changePolicy,
    changeNote: spec.changeNote,
    ...(spec.limitationNote && !missing ? { limitationNote: spec.limitationNote } : {}),
  };
}

function formatNpiType(npiType: WorkspacePersonProfile['npiType']): string | null {
  if (npiType === 'TYPE_1') return 'Individual (Type 1)';
  if (npiType === 'TYPE_2') return 'Organization (Type 2)';
  return null;
}

function joinName(profile: WorkspacePersonProfile | null): string | null {
  const parts = [profile?.firstName, profile?.lastName].filter(
    (part): part is string => Boolean(part && part.trim().length > 0),
  );
  return parts.length > 0 ? parts.join(' ') : null;
}

export function buildClinicianIdentitySurface(
  input: ClinicianIdentitySurfaceInput,
): ClinicianIdentitySurfaceModel {
  const profile = input.isSignedIn ? input.personProfile : null;
  const npi = profile?.npi ?? null;
  const npiBound = Boolean(npi);
  const name = joinName(profile);

  // Real inputs replace the old hardcoded sample: the identifier is
  // resolved iff an NPI is stored (the claim flow resolves it against
  // NPPES before storing), and the name is the claim-flow attestation.
  // governmentIdVerified / livenessVerified are omitted on purpose —
  // passing literal false would assert a failed check that never ran.
  const bindingStatus: ClinicianNpiBindingStatus = input.isSignedIn
    ? evaluateClinicianNpiBindingReadiness({
        identifierResolved: npiBound,
        selfAttestedName: Boolean(name),
      })
    : 'unbound';

  // NPPES-copied fields: the claim flow is the only PersonProfile
  // writer today, so a bound NPI means these values were copied from
  // NPPES. Without a bound NPI nothing about them is source-backed.
  const nppesCopied = npiBound;
  const nppesProvenance: ProfileProvenance = nppesCopied ? 'VERIFIED' : 'USER_ENTERED';
  const nppesConfidence: ProfileFieldConfidence = nppesCopied ? 'source-backed' : 'self-attested';
  const nppesSourceLabel = nppesCopied
    ? 'NPPES (CMS registry) — copied at claim'
    : 'Supplied without a source-of-record check';

  const sections: IdentitySurfaceSection[] = [
    {
      id: 'account',
      title: 'Account identity',
      summary:
        'Your sign-in account authenticates this session. It does not prove clinical identity, and it is separate from your NPI record.',
      fields: [
        buildField({
          id: 'account_session',
          label: 'Account session',
          value: input.isSignedIn ? 'Signed in' : null,
          provenance: 'USER_ENTERED',
          confidence: 'self-attested',
          sourceLabel: 'Sign-in provider session',
          changePolicy: 'account_managed',
          changeNote:
            'Sign-in credentials (email, password, passkeys) are managed in your account settings, not on this page.',
        }),
        buildField({
          id: 'account_email',
          label: 'Account email',
          value: input.isSignedIn ? input.accountEmail : null,
          provenance: 'USER_ENTERED',
          confidence: 'self-attested',
          sourceLabel: 'Sign-in provider account',
          changePolicy: 'account_managed',
          changeNote:
            'Change your email through account settings. It identifies your account, not your clinical record.',
        }),
      ],
    },
    {
      id: 'npi_binding',
      title: 'NPI record',
      summary:
        'The federal identifier this account claims. NPPES resolves the identifier; it does not bind a person to it.',
      fields: [
        buildField({
          id: 'npi',
          label: 'NPI',
          value: npi,
          provenance: 'VERIFIED',
          confidence: 'source-backed',
          sourceLabel: 'NPPES (CMS registry) — resolved at claim',
          changePolicy: 'source_of_record',
          changeNote:
            'An NPI cannot be edited in place. If this is not your NPI, re-run the claim flow. If the NPPES record itself is wrong, correct it with CMS first.',
          limitationNote: STORED_COPY_NOTE,
        }),
        buildField({
          id: 'npi_type',
          label: 'NPI type',
          value: formatNpiType(profile?.npiType ?? null),
          provenance: 'VERIFIED',
          confidence: 'source-backed',
          sourceLabel: 'NPPES (CMS registry) — resolved at claim',
          changePolicy: 'source_of_record',
          changeNote: 'Set by the NPPES record for your NPI; it cannot be edited here.',
          limitationNote: STORED_COPY_NOTE,
        }),
      ],
    },
    {
      id: 'profile_identity',
      title: 'Profile identity',
      summary:
        'Identity fields stored on your VitalCV profile, with the origin of each value labeled.',
      fields: [
        buildField({
          id: 'name_on_file',
          label: 'Name on file',
          value: name,
          provenance: nppesProvenance,
          confidence: nppesConfidence,
          sourceLabel: nppesSourceLabel,
          changePolicy: 'source_of_record',
          changeNote:
            'If your legal name changed, update your NPPES record with CMS first — VitalCV refreshes from the source rather than accepting a typed override.',
          limitationNote: nppesCopied ? STORED_COPY_NOTE : undefined,
        }),
        buildField({
          id: 'specialty',
          label: 'Specialty',
          value: profile?.specialty ?? null,
          provenance: nppesProvenance,
          confidence: nppesConfidence,
          sourceLabel: nppesCopied
            ? 'NPPES primary taxonomy — copied at claim'
            : nppesSourceLabel,
          changePolicy: 'source_of_record',
          changeNote:
            'Specialty follows your NPPES taxonomy. Correct it at the source; a typed override would not be source-backed.',
          limitationNote: nppesCopied ? STORED_COPY_NOTE : undefined,
        }),
        buildField({
          id: 'state_of_practice',
          label: 'State of practice',
          value: profile?.stateOfPractice ?? null,
          provenance: nppesProvenance,
          confidence: nppesConfidence,
          sourceLabel: nppesSourceLabel,
          changePolicy: 'source_of_record',
          changeNote:
            'Copied from your NPPES practice location at claim. Update NPPES to change it.',
          limitationNote: nppesCopied ? STORED_COPY_NOTE : undefined,
        }),
        buildField({
          id: 'work_auth_status',
          label: 'Work authorization status',
          value: profile?.workAuthStatus ?? null,
          provenance: 'USER_ENTERED',
          confidence: 'self-attested',
          sourceLabel: 'Entered on your profile',
          changePolicy: 'editable_profile',
          changeNote:
            'You can update this on your profile. It stays self-attested until a source-backed check exists for it.',
        }),
      ],
    },
  ];

  const gaps: IdentitySurfaceGap[] = [];
  if (!input.isSignedIn) {
    gaps.push({
      id: 'sign_in',
      label: 'No account session',
      description:
        'Sign in to see the identity record VitalCV holds for you. This page shows only the policy until then.',
      href: '/sign-in',
      cta: 'Sign in',
    });
  } else if (!npiBound) {
    gaps.push({
      id: 'claim_npi',
      label: 'No NPI linked',
      description:
        'No NPI binding is loaded for this account. Claim your NPI to resolve it against NPPES and start your source-backed record.',
      href: '/get-ready',
      cta: 'Claim your NPI',
    });
  } else {
    if (!name) {
      gaps.push({
        id: 'name_missing',
        label: 'No name stored with your NPI',
        description:
          'Your NPI is linked but no name record accompanies it. Re-running the claim flow refreshes it from NPPES.',
        href: '/get-ready',
        cta: 'Refresh from NPPES',
      });
    }
    if (!profile?.specialty || !profile?.stateOfPractice) {
      gaps.push({
        id: 'profile_fields',
        label: 'Profile identity fields incomplete',
        description:
          'Specialty or state of practice is missing. Review your profile to see every field and its origin.',
        href: '/clinician/profile',
        cta: 'Review profile',
      });
    }
  }

  return {
    audience: input.isSignedIn ? 'signed_in' : 'signed_out',
    bindingStatus,
    bindingExplanation: explainNpiBindingStatus(bindingStatus),
    sections,
    gaps,
  };
}
