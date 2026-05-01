/**
 * FOUNDATION-SWEEP-7 — verifier review status lifecycle foundation.
 *
 * This is a state vocabulary and transition guard only. It does not automate
 * decisions or activate a production workflow.
 */

export type ReviewLifecycleState =
  | 'not_started'
  | 'consent_pending'
  | 'request_sent'
  | 'response_received'
  | 'assessment_complete'
  | 'unable_to_assess';

export interface ReviewStatusCopy {
  headline: string;
  detail: string;
}

export interface ReviewStatusFoundation {
  provisionLive: false;
  automatedDecisions: false;
  productionWorkflowLive: false;
  states: ReviewLifecycleState[];
  disclaimers: string[];
}

const REVIEW_STATE_ORDER: ReviewLifecycleState[] = [
  'not_started',
  'consent_pending',
  'request_sent',
  'response_received',
  'assessment_complete',
  'unable_to_assess',
];

const ALLOWED_TRANSITIONS: Record<ReviewLifecycleState, ReviewLifecycleState[]> = {
  not_started: ['consent_pending'],
  consent_pending: ['request_sent', 'unable_to_assess'],
  request_sent: ['response_received', 'unable_to_assess'],
  response_received: ['assessment_complete', 'unable_to_assess'],
  assessment_complete: [],
  unable_to_assess: [],
};

export function buildReviewStatusFoundation(): ReviewStatusFoundation {
  return {
    provisionLive: false,
    automatedDecisions: false,
    productionWorkflowLive: false,
    states: REVIEW_STATE_ORDER,
    disclaimers: [
      'Review status tracking is a foundation lifecycle only; no automated decisions are produced.',
      'Production workflow recording is planned and is not enabled by this module.',
    ],
  };
}

export function getReviewStatusCopy(
  state: ReviewLifecycleState,
): ReviewStatusCopy {
  switch (state) {
    case 'not_started':
      return {
        headline: 'Review not started',
        detail: 'The application is available for intake but no assessment activity has been recorded.',
      };
    case 'consent_pending':
      return {
        headline: 'Consent pending',
        detail: 'The reviewer is waiting for the required consent step before sending a source request.',
      };
    case 'request_sent':
      return {
        headline: 'Request sent',
        detail: 'A request has been prepared for the review workflow; response tracking remains a planned production capability.',
      };
    case 'response_received':
      return {
        headline: 'Response received',
        detail: 'Source material is available for internal assessment.',
      };
    case 'assessment_complete':
      return {
        headline: 'Assessment complete',
        detail: 'Internal assessment is complete for the available material; employment eligibility remains an employer decision.',
      };
    case 'unable_to_assess':
      return {
        headline: 'Unable to assess',
        detail: 'The available material is insufficient for this internal assessment record.',
      };
  }
}

export function transitionAllowed(
  from: ReviewLifecycleState,
  to: ReviewLifecycleState,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
