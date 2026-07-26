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
    changesSinceSubmission: ApplicationEvidenceChange[];
    notice: string;
  };
}

export type ApplicationEvidenceLoadResult =
  | { status: 'ok'; data: ApplicationEvidenceViewData }
  | { status: 'not_found' }
  | { status: 'unauthorized' }
  | { status: 'error'; message: string };
