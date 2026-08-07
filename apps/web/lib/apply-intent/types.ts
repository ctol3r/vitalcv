export type ApplyIntentStatus = 'ready' | 'used' | 'expired';

export interface ApplyIntentField {
  sectionId: string;
  fieldId: string;
  label: string;
  value: string | null;
  evidenceState:
    | 'source_backed'
    | 'checked'
    | 'self_attested'
    | 'needs_review'
    | 'access_required'
    | 'unavailable'
    | 'employer_decided';
  sourceId: string;
  sourceObservedAt: string | null;
  freshUntil: string | null;
  artifactId: string | null;
  receiptId: string | null;
}

export interface ApplyIntentView {
  requestUri: string;
  status: ApplyIntentStatus;
  opportunity: {
    id: string;
    version: string;
    title: string;
    specialty: string;
    state: string;
  };
  organization: {
    id: string;
    name: string;
  };
  purpose: string;
  requestedSections: string[];
  requestedCredentialTypes: string[];
  callbackConfigured: boolean;
  returnUrl: string;
  issuedAt: string;
  expiresAt: string;
  clinician?: { npi: string };
  fields?: ApplyIntentField[];
  limitations?: string[];
}

export interface ApplyIntentSubmissionResult {
  applicationId: string;
  opportunityId: string;
  handoffId: string;
  consentGrantId: string;
  packet: {
    id: string;
    version: number;
    hash: string;
    selectedSections: string[];
    fieldCount: number;
  };
  handoffReceipt: {
    id: string;
    attemptNumber: number;
    status: string;
    receiptHash: string;
    issuedAt: string;
  };
  employerReceiptUrl: string;
  returnUrl: string;
  limitations: string[];
}

export interface EmployerHandoffReceipt {
  id: string;
  handoffId: string;
  attemptNumber: number;
  channel: string;
  status: string;
  transportProvider: string | null;
  providerMessageId: string | null;
  limitation: string | null;
  deliveredAt: string | null;
  acknowledgedAt: string | null;
  issuedAt: string;
  receiptHash: string;
}

export interface EmployerApplicationHandoff {
  applicationId: string;
  opportunity: {
    id: string;
    title: string;
    organizationId: string;
  };
  packet: {
    id: string;
    version: number;
    hash: string;
    consentGrantId: string | null;
    purpose: string;
    recipient: string;
    createdAt: string;
  } | null;
  handoffId: string | null;
  deliveryState: 'not_recorded' | 'logged_only' | 'delivered' | 'acknowledged' | 'failed';
  receipts: EmployerHandoffReceipt[];
  notice: string;
}
