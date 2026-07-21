/**
 * Web-side mirror of the backend ACT-7.1 clinician activation view
 * (apps/api/backend/src/services/activation/clinicianActivationView.ts). Kept
 * as a plain type contract so the read loader and the UI share one shape.
 */

export type ClinicianActivationPhase = 'not_started' | 'in_progress' | 'requirements_met';

export type ActivationRequirementStatus =
  | 'not_started'
  | 'requested'
  | 'submitted'
  | 'under_review'
  | 'met'
  | 'waived'
  | 'not_applicable'
  | 'blocked'
  | 'expired';

export type ActivationRequirementCategory =
  | 'evidence'
  | 'policy'
  | 'onboarding'
  | 'contract'
  | 'manual_review';

export type ActivationRequirementOwner = 'clinician' | 'employer' | 'both' | 'system';

export type StartState = 'not_ready' | 'start_ready' | 'started' | 'cancelled';

export interface ClinicianRequirementView {
  id: string;
  label: string;
  category: ActivationRequirementCategory;
  necessity: 'required' | 'preferred';
  status: ActivationRequirementStatus;
  owner: ActivationRequirementOwner;
  isResolved: boolean;
  isBlocking: boolean;
  dueAt: string | null;
  resolvedAt: string | null;
}

export interface ClinicianActivationView {
  applicationId: string;
  phase: ClinicianActivationPhase;
  startState: StartState;
  requirements: ClinicianRequirementView[];
  summary: {
    total: number;
    requiredOpen: number;
    hasHardBlocker: boolean;
    requiredMet: boolean;
  };
}

export type ActivationLoadResult =
  | { status: 'ok'; data: ClinicianActivationView }
  | { status: 'unauthorized' }
  | { status: 'not_found' }
  | { status: 'error'; message: string };
