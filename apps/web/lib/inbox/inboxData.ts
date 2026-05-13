/**
 * Wave D Phase 2 — AI Knowledge Inbox data shape + demo fixture.
 *
 * Pure types + a single demoInbox() fixture. No fetch, no DB, no DOM.
 *
 * PRINCIPLE (from data-inbox.jsx):
 *   Classification organizes information.
 *   Source checks decide what becomes verified.
 *
 * Truth contract:
 *   - The provenance vocabulary distinguishes AI extractions from
 *     primary-source confirmations. The "source_confirmed" provenance
 *     is the strongest possible state and means a primary-source
 *     authority confirmed the field during ingest. We do NOT use the
 *     bare-word status label banned by CLAUDE.md anywhere — so the
 *     design's `verified` provenance maps to `source_confirmed` here,
 *     with a label "Source-confirmed".
 *   - The page that renders this data always carries a
 *     "Demo intake — illustrative only" banner. data-is-demo is the
 *     literal `true`.
 *   - This module does NOT introduce a real OCR pipeline, classifier,
 *     or PSV check. The demo data describes the *shape* of intake,
 *     not active intelligence.
 */

export type InboxProvenance =
  | 'source_confirmed'
  | 'inferred'
  | 'user_entered'
  | 'unknown'
  | 'contradicted';

export interface InboxProvenanceMeta {
  /** Visible label. We intentionally do not use the bare-word
   *  status label banned by CLAUDE.md — see banned-status-labels. */
  label: string;
  description: string;
  glyph: string;
  /** Subtle styling token. Resolved to actual classes in the page. */
  tone: 'emerald' | 'amber' | 'slate' | 'purple';
}

export const INBOX_PROVENANCE_META: Record<InboxProvenance, InboxProvenanceMeta> = {
  source_confirmed: {
    label: 'Source-confirmed',
    description:
      'Confirmed against a primary-source authority during ingest.',
    glyph: '✔',
    tone: 'emerald',
  },
  inferred: {
    label: 'Inferred',
    description:
      'AI-extracted from this document. Not primary-source confirmed.',
    glyph: '≈',
    tone: 'amber',
  },
  user_entered: {
    label: 'User-entered',
    description:
      'Typed by the clinician. Owned but not source-checked.',
    glyph: '✎',
    tone: 'slate',
  },
  unknown: {
    label: 'Unknown',
    description:
      'Not found in this document. Not a negative signal.',
    glyph: '?',
    tone: 'amber',
  },
  contradicted: {
    label: 'Contradicted',
    description:
      'Two extractions disagree. Requires reconciliation.',
    glyph: '⑂',
    tone: 'purple',
  },
};

export type DocClassification =
  | 'cv'
  | 'state_license'
  | 'board_cert'
  | 'dea'
  | 'malpractice'
  | 'diploma'
  | 'attestation'
  | 'unknown';

export interface DocClassMeta {
  label: string;
  glyph: string;
}

export const DOC_CLASS_META: Record<DocClassification, DocClassMeta> = {
  cv:            { label: 'Curriculum Vitae',       glyph: 'CV'  },
  state_license: { label: 'State License',          glyph: 'SL'  },
  board_cert:    { label: 'Board Certification',    glyph: 'BC'  },
  dea:           { label: 'Controlled-Substance Authority', glyph: 'CSA' },
  malpractice:   { label: 'Malpractice COI',        glyph: 'COI' },
  diploma:       { label: 'Diploma / Transcript',   glyph: 'EDU' },
  attestation:   { label: 'Self-Attestation',       glyph: 'ATT' },
  unknown:       { label: 'Unclassified',           glyph: '?'   },
};

export type DocState = 'queued' | 'classifying' | 'processed' | 'unclassified';

export interface InboxDocument {
  id: string;
  name: string;
  bytes: number;
  pages: number;
  receivedAt: string;
  receivedRel: string;
  state: DocState;
  classification: DocClassification | null;
  /** 0..1 confidence the classifier assigned. Null while classifying. */
  classificationConfidence: number | null;
  classificationReason?: string;
  extractedCount: number;
}

export interface InboxExtractedField {
  /** Profile field this maps into, e.g. "name.full" or "license.state". */
  fieldKey: string;
  label: string;
  value: string;
  provenance: InboxProvenance;
  /** Confidence for AI extractions; null for non-inferred provenance. */
  confidence: number | null;
}

export interface InboxSuggestion {
  id: string;
  fieldKey: string;
  label: string;
  /** What the inbox proposes to write into the profile. */
  suggestedValue: string;
  /** What the profile currently holds (may be null on a new field). */
  currentValue: string | null;
  /** AI confidence at suggestion time. */
  confidence: number;
  /** Document this suggestion was extracted from. */
  sourceDocId: string;
}

export interface InboxStats {
  docCount: number;
  processed: number;
  classifying: number;
  unclassified: number;
  extractedFields: number;
  suggestionCount: number;
}

export interface InboxState {
  isDemo: true;
  documents: ReadonlyArray<InboxDocument>;
  /** Per-document extracted fields. */
  extractions: Readonly<Record<string, ReadonlyArray<InboxExtractedField>>>;
  suggestions: ReadonlyArray<InboxSuggestion>;
}

export function computeInboxStats(state: InboxState): InboxStats {
  let processed = 0;
  let classifying = 0;
  let unclassified = 0;
  let extractedFields = 0;
  for (const doc of state.documents) {
    if (doc.state === 'processed') processed++;
    else if (doc.state === 'classifying') classifying++;
    else if (doc.state === 'unclassified') unclassified++;
  }
  for (const list of Object.values(state.extractions)) {
    extractedFields += list.length;
  }
  return {
    docCount: state.documents.length,
    processed,
    classifying,
    unclassified,
    extractedFields,
    suggestionCount: state.suggestions.length,
  };
}

/** Pretty bytes — kB / MB. Pure helper, testable. */
export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} kB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function demoInbox(): InboxState {
  const documents: ReadonlyArray<InboxDocument> = [
    {
      id: 'doc-001',
      name: 'demo-cv-2026-04.pdf',
      bytes: 184_392,
      pages: 3,
      receivedAt: '2026-04-18T14:18:00Z',
      receivedRel: '14 min ago',
      state: 'processed',
      classification: 'cv',
      classificationConfidence: 0.94,
      classificationReason:
        'Header parsed as a clinician name with credential suffix. Section structure matches the CV pattern (Education → Experience → Certifications). 7 employment entries detected.',
      extractedCount: 11,
    },
    {
      id: 'doc-002',
      name: 'demo-state-license-renewal.pdf',
      bytes: 612_104,
      pages: 1,
      receivedAt: '2026-04-18T14:09:00Z',
      receivedRel: '23 min ago',
      state: 'processed',
      classification: 'state_license',
      classificationConfidence: 0.99,
      classificationReason:
        'State professional-licensure board letterhead detected. Wallet-card layout. License number format matches state pattern.',
      extractedCount: 7,
    },
    {
      id: 'doc-003',
      name: 'demo-board-certification-2025.pdf',
      bytes: 248_712,
      pages: 2,
      receivedAt: '2026-04-18T14:02:00Z',
      receivedRel: '30 min ago',
      state: 'processed',
      classification: 'board_cert',
      classificationConfidence: 0.97,
      classificationReason:
        'Issuing-board seal recognized. Certification ID format matches pattern.',
      extractedCount: 6,
    },
    {
      id: 'doc-004',
      name: 'demo-photo.heic',
      bytes: 2_840_122,
      pages: 1,
      receivedAt: '2026-04-18T14:31:00Z',
      receivedRel: '1 min ago',
      state: 'classifying',
      classification: null,
      classificationConfidence: null,
      extractedCount: 0,
    },
    {
      id: 'doc-005',
      name: 'demo-unknown-form.pdf',
      bytes: 96_433,
      pages: 1,
      receivedAt: '2026-04-17T22:51:00Z',
      receivedRel: 'yesterday',
      state: 'unclassified',
      classification: 'unknown',
      classificationConfidence: 0.31,
      classificationReason:
        'No recognized issuer letterhead. Text density low. Best three guesses: continuing-education certificate (0.31), insurance card (0.18), training receipt (0.11).',
      extractedCount: 0,
    },
  ];

  const extractions: Record<string, ReadonlyArray<InboxExtractedField>> = {
    'doc-001': [
      { fieldKey: 'name.full',         label: 'Full name',       value: 'Macie Miller, PA-C',                                provenance: 'inferred',     confidence: 0.93 },
      { fieldKey: 'credential.suffix', label: 'Credential',      value: 'PA-C',                                              provenance: 'inferred',     confidence: 0.95 },
      { fieldKey: 'employer.recent',   label: 'Most recent employer', value: 'Demo Surgical Pavilion · 2024–present',         provenance: 'inferred',     confidence: 0.81 },
      { fieldKey: 'training.school',   label: 'PA training program',  value: 'Demo State University PA Program',              provenance: 'inferred',     confidence: 0.74 },
    ],
    'doc-002': [
      { fieldKey: 'license.state',     label: 'License state',   value: 'CA',                                                provenance: 'inferred',     confidence: 0.99 },
      { fieldKey: 'license.number',    label: 'License number',  value: 'PA-58129',                                          provenance: 'inferred',     confidence: 0.97 },
      { fieldKey: 'license.expires',   label: 'Expires',         value: '2027-06-30',                                        provenance: 'inferred',     confidence: 0.95 },
      { fieldKey: 'license.holder',    label: 'License holder',  value: 'Macie Miller',                                      provenance: 'inferred',     confidence: 0.96 },
    ],
    'doc-003': [
      { fieldKey: 'cert.body',         label: 'Issuing body',    value: 'Demo Board (PA)',                                   provenance: 'inferred',     confidence: 0.96 },
      { fieldKey: 'cert.id',           label: 'Certificate ID',  value: 'BC-DEMO-9931',                                      provenance: 'inferred',     confidence: 0.93 },
      { fieldKey: 'cert.expires',      label: 'Expires',         value: '2031-12-31',                                        provenance: 'inferred',     confidence: 0.94 },
    ],
  };

  const suggestions: ReadonlyArray<InboxSuggestion> = [
    {
      id: 'sug-1',
      fieldKey: 'license.state',
      label: 'Set primary licensure state to CA',
      suggestedValue: 'CA',
      currentValue: null,
      confidence: 0.99,
      sourceDocId: 'doc-002',
    },
    {
      id: 'sug-2',
      fieldKey: 'license.number',
      label: 'Set primary license number to PA-58129',
      suggestedValue: 'PA-58129',
      currentValue: null,
      confidence: 0.97,
      sourceDocId: 'doc-002',
    },
    {
      id: 'sug-3',
      fieldKey: 'cert.body',
      label: 'Set certifying body to Demo Board',
      suggestedValue: 'Demo Board (PA)',
      currentValue: null,
      confidence: 0.96,
      sourceDocId: 'doc-003',
    },
  ];

  return { isDemo: true, documents, extractions, suggestions };
}
