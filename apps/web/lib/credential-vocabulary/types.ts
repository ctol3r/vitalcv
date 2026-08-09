/**
 * Credential vocabulary types — the preset post-nominal system (K2 of the
 * medical knowledge base program; see
 * docs/research/medical-knowledge-domain-and-publications-2026-08-09.md §D2).
 *
 * Core principle: "Jane Q. Smith, MD, MPH, FACC" is a RENDER, never a stored
 * string. Credentials are structured rows; the suffix line is a deterministic
 * projection with per-profession ordering rules (ANCC's published standard for
 * nursing, APTA's license-first convention for PT, physician convention for
 * MDs). No free-texted suffix ever renders — unknown tokens are excluded and
 * reported, the same fail-closed posture as the PSV chain.
 *
 * Truth posture (same contract as lib/institutions/curated.ts and
 * lib/specialty-ontology): a hand-curated reference DIRECTORY. Holding a row
 * here is never a verification of any person's credential.
 *
 * The suffix TOKEN is deliberately NOT unique — FAAN, FCCP, and FAAO each
 * legally belong to two different issuers. Identity is (token, issuer); every
 * ambiguous token must be declared in KNOWN_COLLISION_TOKENS or the test
 * suite fails.
 */

export type CredentialKind =
  | 'degree'
  | 'license'
  | 'state_designation'
  | 'national_certification'
  | 'fellowship_honor';

export type CredentialVerifiability =
  | 'public_registry' // free public lookup exists
  | 'roster'          // published fellow/diplomate lists or announcements
  | 'on_request'      // issuer confirms by phone/email
  | 'paid_psv'        // verification exists but behind a paid product
  | 'none';

export type ProfessionScope =
  | 'physician'
  | 'nurse'
  | 'physician_associate'
  | 'pharmacist'
  | 'physical_therapist'
  | 'occupational_therapist'
  | 'slp_audiology'
  | 'dietetics'
  | 'respiratory_care'
  | 'radiologic_technology'
  | 'laboratory'
  | 'emergency_services'
  | 'behavioral_health'
  | 'athletic_training'
  | 'healthcare_admin'
  | 'informatics'
  | 'any';

export interface CredentialIssuer {
  /** Stable kebab-case slug. Issuers are entities — never matched by acronym. */
  id: string;
  name: string;
  abbrev?: string;
  /** Link to lib/institutions/curated.ts when the issuer is in the directory. */
  institutionId?: string;
}

export interface CredentialDef {
  /** Globally unique slug (e.g. 'faan-nursing' vs 'faan-neurology'). */
  id: string;
  /**
   * The rendered post-nominal in its official citation form
   * (e.g. 'FNP-BC', 'MLS(ASCP)', 'R.T.(R)(ARRT)'). NOT unique across defs.
   */
  token: string;
  name: string;
  issuerId: string;
  kind: CredentialKind;
  professionScopes: readonly ProfessionScope[];
  /** Degree-dedup scope: only the highest-ranked degree per field renders. */
  field?: string;
  /** Higher renders first within a kind; degrees also dedup on this per field. */
  rank?: number;
  verifiability: CredentialVerifiability;
  verifyUrl?: string;
  status: 'active' | 'legacy';
  /** For renamed credentials (RN-BC → MEDSURG-BC); target must exist. */
  renamedToId?: string;
  note?: string;
}

export type OrderingProfileId =
  | 'physician'
  | 'nursing'
  | 'physician_associate'
  | 'physical_therapy'
  | 'default';

export interface OrderingProfile {
  id: OrderingProfileId;
  /** The published convention this profile encodes. */
  authority: string;
  /** Kinds in render order; kinds absent from the list do not render. */
  order: readonly CredentialKind[];
}

export interface HeldCredential {
  credentialDefId: string;
  /** User opt-out (ANCC permits trimming; many physicians omit an MBA). */
  showInSuffix?: boolean;
}

export interface RenderedPostNominals {
  /** The suffix line, e.g. 'DNP, RN, APRN, FNP-BC, FAAN'. */
  rendered: string;
  tokens: readonly string[];
  /** Ids that did not resolve — excluded fail-closed, never guessed at. */
  unknownIds: readonly string[];
  /** Ids excluded as legacy, opted out, or deduped (lower degree in a field). */
  excludedIds: readonly string[];
}
