export type RequestReviewFailureCode =
  | 'EMPLOYER_SESSION_REQUIRED'
  | 'EMPLOYER_WORKSPACE_REQUIRED'
  | 'EMPLOYER_WORKSPACE_LOOKUP_FAILED'
  | 'EMPLOYER_WORKSPACE_IDENTITY_REQUIRED'
  | 'EMPLOYER_REQUESTOR_ENTITY_REQUIRED'
  | 'CLINICIAN_PASSPORT_REQUIRED'
  | 'REQUEST_REVIEW_UNAVAILABLE';

export type RequestReviewNextStep =
  | 'sign_in'
  | 'create_workspace'
  | 'complete_workspace_identity'
  | 'run_clinician_readiness'
  | 'retry_request_review';

export interface RequestReviewErrorPayload {
  code: RequestReviewFailureCode;
  error: string;
  hint?: string;
  nextStep: RequestReviewNextStep;
}

export function isRequestReviewErrorPayload(
  value: unknown,
): value is RequestReviewErrorPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.code === 'string'
    && typeof record.error === 'string'
    && typeof record.nextStep === 'string'
  );
}
