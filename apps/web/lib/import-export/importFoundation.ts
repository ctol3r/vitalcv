/**
 * FOUNDATION-SWEEP-2 — import / export foundation.
 *
 * Truth invariants:
 *   - LinkedIn / Doximity / PubMed integrations are PLANNED or
 *     ENTRY-ONLY. None ship a live two-way sync today.
 *   - Imported or uploaded data is NEVER verified by import alone.
 *     Verification requires a separate source-of-record check.
 *   - Provenance labels reflect *origin*, not *trust*. The strongest
 *     label this foundation produces is `imported-candidate`.
 *   - Import errors are explicit and user-safe — never expose raw
 *     network/parser stack traces or secrets.
 */

export type ImportEntryKind =
  | 'cv_upload'
  | 'document_upload'
  | 'linkedin_import'
  | 'doximity_import'
  | 'pubmed_import'
  | 'csv_roster_import'
  | 'export_bundle'
  | 'shareable_passport';

export type ImportIntegrationStatus =
  | 'planned'
  | 'entry_only'
  | 'partial'
  | 'live';

export type ImportProvenanceStatus =
  | 'self_attested'
  | 'imported_candidate'
  | 'source_backed'
  | 'unknown'
  | 'conflict';

export type ImportErrorKind =
  | 'unsupported_file_type'
  | 'file_too_large'
  | 'parse_failure'
  | 'integration_unavailable'
  | 'rate_limited'
  | 'transport_error'
  | 'validation_failed'
  | 'unknown';

export interface ImportFoundationEntry {
  kind: ImportEntryKind;
  title: string;
  /** Plain-language description of what this entry does today. */
  description: string;
  status: ImportIntegrationStatus;
  /** Optional one-line roadmap note for planned/entry-only entries. */
  roadmapNote?: string;
}

export interface ImportErrorState {
  kind: ImportErrorKind;
  /** Short, user-safe message; never includes raw payload or secrets. */
  userMessage: string;
  /** Suggested next action the user can take. */
  remediation: string;
}

const SAFE_ERROR_MESSAGES: Record<ImportErrorKind, ImportErrorState> = {
  unsupported_file_type: {
    kind: 'unsupported_file_type',
    userMessage: 'This file type is not supported.',
    remediation: 'Try uploading a PDF, DOCX, or plain-text file.',
  },
  file_too_large: {
    kind: 'file_too_large',
    userMessage: 'The file is larger than the upload limit.',
    remediation: 'Try a smaller file (under 10 MB) or split the document.',
  },
  parse_failure: {
    kind: 'parse_failure',
    userMessage: 'The file could not be read.',
    remediation: 'Check that the file is not encrypted or corrupted, then try again.',
  },
  integration_unavailable: {
    kind: 'integration_unavailable',
    userMessage: 'This integration is not available right now.',
    remediation: 'Try again later, or use a different import path.',
  },
  rate_limited: {
    kind: 'rate_limited',
    userMessage: 'The import source is rate-limiting requests.',
    remediation: 'Wait a few minutes and try again.',
  },
  transport_error: {
    kind: 'transport_error',
    userMessage: 'A network problem prevented the import from completing.',
    remediation: 'Check your connection and try again.',
  },
  validation_failed: {
    kind: 'validation_failed',
    userMessage: 'The imported content did not pass validation.',
    remediation: 'Review the entries flagged in the inbox before continuing.',
  },
  unknown: {
    kind: 'unknown',
    userMessage: 'The import did not complete.',
    remediation: 'Try again or contact support if the problem continues.',
  },
};

const PROVENANCE_LABELS: Record<ImportProvenanceStatus, string> = {
  self_attested: 'Self-attested (clinician-supplied; not verified)',
  imported_candidate: 'Imported candidate (origin recorded; not verified)',
  source_backed: 'Source-backed (a source-of-record check has run)',
  unknown: 'Unknown (no data on file)',
  conflict: 'Conflict (sources disagree; pending review)',
};

const FOUNDATION_ENTRIES: ImportFoundationEntry[] = [
  {
    kind: 'cv_upload',
    title: 'CV upload',
    description:
      'Upload a CV or resume. Document parsing into structured profile fields is not wired in this entry point.',
    status: 'entry_only',
  },
  {
    kind: 'document_upload',
    title: 'Document upload',
    description:
      'Attach a credentialing document (license, certificate, attestation). Source-backed verification of the document is a separate path.',
    status: 'entry_only',
  },
  {
    kind: 'linkedin_import',
    title: 'LinkedIn import',
    description:
      'Pull employment and education from LinkedIn.',
    status: 'planned',
    roadmapNote: 'No live LinkedIn sync ships today.',
  },
  {
    kind: 'doximity_import',
    title: 'Doximity import',
    description:
      'Pull profile content from Doximity.',
    status: 'planned',
    roadmapNote: 'No live Doximity sync ships today.',
  },
  {
    kind: 'pubmed_import',
    title: 'PubMed import',
    description:
      'Pull authored publications from PubMed. Imported entries are imported-candidates until a source-backed check upgrades them.',
    status: 'entry_only',
    roadmapNote: 'In-product PubMed fetch + dedupe is planned.',
  },
  {
    kind: 'csv_roster_import',
    title: 'CSV / roster import',
    description:
      'Bulk-import a roster of clinicians. Some CSV ingest paths exist for pilot ops; full roster automation is planned.',
    status: 'entry_only',
  },
  {
    kind: 'export_bundle',
    title: 'Export bundle',
    description:
      'Export an audit-ready bundle of your filled fields and any attached evidence. Bundle UX is in progress; cryptographic signing of exports is planned.',
    status: 'entry_only',
  },
  {
    kind: 'shareable_passport',
    title: 'Shareable passport',
    description:
      'Generate a public/limited-share passport URL for your profile. Provenance labels accompany every field on the share view.',
    status: 'entry_only',
  },
];

export function buildImportFoundationEntries(): ImportFoundationEntry[] {
  return FOUNDATION_ENTRIES.map((entry) => ({ ...entry }));
}

export function explainImportIntegrationStatus(status: ImportIntegrationStatus): string {
  switch (status) {
    case 'planned':
      return 'Planned — no live integration ships today.';
    case 'entry_only':
      return 'Entry point only — capture surface exists; full integration is not wired.';
    case 'partial':
      return 'Partial — limited integration ships; some paths are still planned.';
    case 'live':
      return 'Live — integration is shipped and validated.';
  }
}

/**
 * Build a user-safe import error state from an arbitrary input. Never
 * leaks raw error objects or upstream payload. Defaults to the
 * `unknown` template if the kind is not recognized.
 */
export function buildImportErrorState(input: { kind: ImportErrorKind | string }): ImportErrorState {
  const kind = (Object.keys(SAFE_ERROR_MESSAGES) as ImportErrorKind[]).includes(
    input.kind as ImportErrorKind,
  )
    ? (input.kind as ImportErrorKind)
    : 'unknown';
  return { ...SAFE_ERROR_MESSAGES[kind] };
}

export function getImportProvenanceLabel(status: ImportProvenanceStatus): string {
  return PROVENANCE_LABELS[status];
}
