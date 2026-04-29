/**
 * FOUNDATION-SWEEP-5 — professional import foundation.
 *
 * Truth invariants:
 *   1. LinkedIn and Doximity imports are PLANNED or ENTRY-ONLY. No
 *      live two-way sync ships. Every entry is `isLive: false`.
 *   2. PubMed import is candidate-only — `candidate_ready` at most.
 *      Imported records remain candidates until a source-backed
 *      check upgrades them.
 *   3. NO scraping. NO credential collection. NO password capture.
 *      Disclaimers say so verbatim and are renderable on the route.
 *   4. Manual CV data is `user_entered` until source-backed.
 *   5. The strongest provenance this foundation produces is
 *      `source_candidate` (a candidate match against a real source
 *      that still requires a separate verifier wave).
 */

export type ProfessionalImportKind =
  | 'linkedin_profile'
  | 'doximity_profile'
  | 'pubmed_publications'
  | 'manual_cv'
  | 'csv_roster';

export type ProfessionalImportStatus =
  | 'planned'
  | 'entry_only'
  | 'candidate_ready'
  | 'source_candidate'
  | 'source_backed'
  | 'unavailable'
  | 'blocked';

export type ProfessionalImportCapability =
  | 'identity_disambiguation'
  | 'author_match_required'
  | 'consent_required'
  | 'audit_safe_receipt'
  | 'no_scraping'
  | 'no_credential_collection';

export interface ProfessionalImportEntry {
  kind: ProfessionalImportKind;
  label: string;
  description: string;
  /** Is this import shipped + verified today? Always false. */
  isLive: boolean;
  status: ProfessionalImportStatus;
  /** Capabilities required before this import could ship live. */
  requiredCapabilities: ProfessionalImportCapability[];
  /** One-line roadmap note. */
  roadmapNote: string;
}

export interface ProfessionalImportReadinessInput {
  kind: ProfessionalImportKind;
  hasIdentityDisambiguation: boolean;
  hasConsentRecord: boolean;
  sourceMatchAttached: boolean;
}

export interface ProfessionalImportReadinessResult {
  status: ProfessionalImportStatus;
  /** Always false in this foundation. */
  productionReady: false;
  notes: string[];
}

const NO_SCRAPING_DISCLAIMER =
  'No scraping or credential collection is performed by this foundation.';
const PLANNED_DISCLAIMER =
  'LinkedIn and Doximity imports are planned entry points, not live integrations.';
const PUBMED_CANDIDATE_DISCLAIMER =
  'PubMed entries are publication candidates until source-backed matching is attached.';
const MANUAL_USER_ENTERED_DISCLAIMER =
  'Manual CV / document uploads remain user-entered until a source-backed check upgrades them.';

const ENTRY_DEFS: ProfessionalImportEntry[] = [
  {
    kind: 'linkedin_profile',
    label: 'LinkedIn profile import',
    description:
      'Pull employment, education, and affiliations from LinkedIn. Planned entry point only — no live LinkedIn sync ships, no scraping, no credential collection.',
    isLive: false,
    status: 'planned',
    requiredCapabilities: [
      'identity_disambiguation',
      'consent_required',
      'audit_safe_receipt',
      'no_scraping',
      'no_credential_collection',
    ],
    roadmapNote:
      'Requires an authorized API path (no scraping) and a consent record before any LinkedIn surface ships.',
  },
  {
    kind: 'doximity_profile',
    label: 'Doximity profile import',
    description:
      'Pull profile content from Doximity. Planned entry point only — no live Doximity sync, no scraping, no credential collection.',
    isLive: false,
    status: 'planned',
    requiredCapabilities: [
      'identity_disambiguation',
      'consent_required',
      'audit_safe_receipt',
      'no_scraping',
      'no_credential_collection',
    ],
    roadmapNote:
      'Requires an authorized integration and a consent record before any Doximity surface ships.',
  },
  {
    kind: 'pubmed_publications',
    label: 'PubMed publication import',
    description:
      'Pull authored publications from PubMed. Imported records are publication candidates — they require author/NPI/person disambiguation before any "yours" claim can be made.',
    isLive: false,
    status: 'candidate_ready',
    requiredCapabilities: [
      'identity_disambiguation',
      'author_match_required',
      'audit_safe_receipt',
    ],
    roadmapNote:
      'In-product fetch + dedupe is planned; matching is a separate verifier wave.',
  },
  {
    kind: 'manual_cv',
    label: 'Manual CV / document upload',
    description:
      'Upload a CV / resume / credentialing document. Captured content is user-entered until a source-backed check upgrades it.',
    isLive: false,
    status: 'entry_only',
    requiredCapabilities: ['audit_safe_receipt'],
    roadmapNote:
      'Document parsing into structured profile fields is a separate wave.',
  },
  {
    kind: 'csv_roster',
    label: 'CSV / roster import',
    description:
      'Bulk-import a roster of clinicians for pilot ops. Some CSV ingest paths exist; full automation is planned.',
    isLive: false,
    status: 'entry_only',
    requiredCapabilities: ['audit_safe_receipt'],
    roadmapNote: 'Roster automation is a pilot-ops wave.',
  },
];

export function buildProfessionalImportFoundationEntries(): ProfessionalImportEntry[] {
  return ENTRY_DEFS.map((e) => ({ ...e, requiredCapabilities: [...e.requiredCapabilities] }));
}

export function explainProfessionalImportStatus(status: ProfessionalImportStatus): string {
  switch (status) {
    case 'planned':
      return 'Planned entry point. No live integration ships.';
    case 'entry_only':
      return 'Entry point only — capture surface exists; full integration is not wired.';
    case 'candidate_ready':
      return 'Imported as candidates. Requires identity disambiguation before any "yours" claim.';
    case 'source_candidate':
      return 'A candidate match against a real source exists. Verification is a separate wave.';
    case 'source_backed':
      return 'A source-of-record check has run. Still not equivalent to credential verification.';
    case 'unavailable':
      return 'Import is unavailable in this environment.';
    case 'blocked':
      return 'Import is blocked by policy or missing prerequisites.';
  }
}

/**
 * Evaluate readiness for a single import. Truth-contract invariants:
 *   - `productionReady` is ALWAYS `false` from this foundation.
 *   - The strongest returned status is `source_candidate` (only when
 *     a real source match has already been attached); otherwise the
 *     function returns the entry's catalog status.
 */
export function evaluateProfessionalImportReadiness(
  input: ProfessionalImportReadinessInput,
): ProfessionalImportReadinessResult {
  const entry = ENTRY_DEFS.find((e) => e.kind === input.kind);
  if (!entry) {
    return {
      status: 'unavailable',
      productionReady: false,
      notes: [`Unknown import kind: ${input.kind}`],
    };
  }
  const notes: string[] = [];
  if (entry.requiredCapabilities.includes('consent_required') && !input.hasConsentRecord) {
    notes.push('Consent record is required before this import can proceed.');
  }
  if (entry.requiredCapabilities.includes('identity_disambiguation') && !input.hasIdentityDisambiguation) {
    notes.push('Identity disambiguation is required before any "yours" claim can be made.');
  }
  let status: ProfessionalImportStatus = entry.status;
  if (input.sourceMatchAttached && status === 'candidate_ready') {
    status = 'source_candidate';
  }
  return {
    status,
    productionReady: false,
    notes,
  };
}

export const PROFESSIONAL_IMPORT_DISCLAIMERS = [
  PLANNED_DISCLAIMER,
  PUBMED_CANDIDATE_DISCLAIMER,
  MANUAL_USER_ENTERED_DISCLAIMER,
  NO_SCRAPING_DISCLAIMER,
] as const;
