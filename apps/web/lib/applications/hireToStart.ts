import type { ApplicationEvidenceViewData } from './evidenceView';

export type HireToStartStage =
  | 'application_submitted'
  | 'employer_review'
  | 'clarification'
  | 'head_start_accepted'
  | 'requirements_in_progress'
  | 'start_ready'
  | 'started'
  | 'not_proceeding'
  | 'cancelled';

export interface HireToStartRequirement {
  id: string;
  category: string;
  label: string;
  necessity: string;
  status: string;
  owner: string;
  evidenceRule: string | null;
  dependencyIds: string[];
  dueAt: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  policyVersion: string | null;
}

export interface HireToStartCase {
  application: {
    id: string;
    status: string;
    submittedAt: string;
    opportunity: {
      id: string;
      submittedVersion: string | null;
      currentVersion: string;
      title: string;
      specialty: string;
      hiringType: string;
      state: string;
      organizationId: string;
    };
  };
  accessPerspective: 'clinician' | 'employer' | 'admin';
  submission: ApplicationEvidenceViewData;
  packetBinding: {
    state: 'bound' | 'legacy_unbound' | 'not_opened';
    packetVersion: number | null;
    packetHash: string | null;
    integrity: 'valid' | 'legacy_unavailable';
    limitations: string[];
  };
  decision: null | {
    state: 'under_review' | 'accepted_as_head_start' | 'not_proceeding';
    decidedAt: string | null;
    acceptanceId: string | null;
    packetHash: string | null;
    institutionReviewRemains: true;
  };
  currentStage: HireToStartStage;
  intendedStartDate: string | null;
  actualStart: null | {
    attestationId: string;
    actualFirstDay: string;
    recordedAt: string;
    employerConfirmed: true;
  };
  requirements: HireToStartRequirement[];
  blockerSummary: Array<{
    requirementId: string;
    label: string;
    status: string;
    owner: string;
    dueAt: string | null;
  }>;
  primaryNextAction: {
    kind: string;
    owner: 'clinician' | 'employer' | 'system' | 'both';
    label: string;
    objectId: string | null;
  };
  milestones: Array<{
    type:
      | 'application_submitted'
      | 'employer_first_review'
      | 'decision_recorded'
      | 'head_start_accepted'
      | 'start_ready_recorded'
      | 'actual_start_confirmed';
    occurredAt: string;
  }>;
  externalSystemSync: {
    state: 'not_configured';
    lastEventAt: null;
    limitations: string[];
  };
  limitations: string[];
}

export type HireToStartLoadResult =
  | { status: 'ok'; data: HireToStartCase }
  | { status: 'unauthorized' }
  | { status: 'not_found' }
  | { status: 'error'; message: string };
