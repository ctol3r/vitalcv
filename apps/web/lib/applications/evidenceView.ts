import type { EvidenceState } from '@/lib/vital/evidenceState';

export interface ApplicationEvidenceField {
  sectionId: string;
  fieldId: string;
  label: string;
  value: string | null;
  evidenceState: EvidenceState | 'employer_decided';
  sourceId: string;
  sourceObservedAt: string | null;
  freshUntil: string | null;
  artifactId: string | null;
  receiptId: string | null;
}

/**
 * A selected section that contributed no field at all.
 *
 * The API sends these because `selectedSections` on its own could not carry the
 * difference between "licensure was checked and came back clean" and "nothing
 * was found for licensure" — an employer reading a section name with no rows
 * beneath it fills the silence in the clinician's favour. The state is a strict
 * subset of `EvidenceState`, never an affirmative one.
 */
export interface ApplicationEvidenceAbsence {
  sectionId: string;
  evidenceState: Extract<EvidenceState, 'unavailable' | 'access_required' | 'needs_review'>;
  reason: string;
}

export type ApplicationEvidenceChangeKind =
  | 'unchanged'
  | 'added_after_submission'
  | 'changed_after_submission'
  | 'resolved_after_submission'
  | 'became_stale'
  | 'became_unavailable'
  | 'removed_after_submission';

export interface ApplicationEvidenceChange {
  fieldId: string;
  label: string;
  kind: ApplicationEvidenceChangeKind;
  submitted: ApplicationEvidenceField | null;
  current: ApplicationEvidenceField | null;
}

export interface ApplicationEvidenceViewData {
  applicationId: string;
  opportunityId: string;
  accessPerspective: 'clinician' | 'employer' | 'admin';
  mode: 'sealed' | 'legacy';
  submittedPacket: {
    packetVersion: number;
    packetHash: string;
    clinicianNpi: string;
    integrity: 'valid';
    purpose: string;
    recipient: string;
    consentAt: string;
    consentReceiptId: string;
    selectedSections: string[];
    fields: ApplicationEvidenceField[];
    /**
     * Read out of the seal. `null` = this record was sealed before absences
     * were captured, which is NOT the same as "no sections were empty" — the
     * empty array is that claim, and only records sealed after the invariant
     * can make it.
     */
    sectionAbsences: ApplicationEvidenceAbsence[] | null;
    /**
     * Selected sections with neither a field nor an absence. Empty for records
     * sealed under the invariant; non-empty only for older ones, where it names
     * the silences the reader must not take for clean checks.
     */
    unexplainedSectionIds: string[];
    methodologyVersion: string;
    clinicianNote: string | null;
    lifecycle: 'active' | 'superseded' | 'revoked';
  } | null;
  legacyNotice: string | null;
  currentEvidence: {
    status: 'available' | 'unavailable';
    observedAt: string | null;
    methodologyVersion: string | null;
    fields: ApplicationEvidenceField[];
    /** Sections producing nothing from CURRENT sources — recomputed, like `fields`. */
    sectionAbsences: ApplicationEvidenceAbsence[];
    changesSinceSubmission: ApplicationEvidenceChange[];
    notice: string;
  };
}

export type ApplicationEvidenceLoadResult =
  | { status: 'ok'; data: ApplicationEvidenceViewData }
  | { status: 'not_found' }
  | { status: 'unauthorized' }
  | { status: 'error'; message: string };
