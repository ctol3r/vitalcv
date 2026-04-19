export const PILOT_REQUEST_OWNER = 'Pilot Success';

export const PILOT_REQUEST_NEXT_STEP =
  'Pilot Success will confirm scope, clinician count, and the first clinician NPI for employer review.';

export const PILOT_REQUEST_METRIC_NOTICE =
  'Pilot KPI baselines stay unavailable until the pilot records a real employer review open and employer decision on the same case.';

export const PILOT_REQUEST_SUCCESS_CRITERIA = [
  'Use one real clinician NPI to create a reviewable passport and employer decision context.',
  'Record a real employer review open and employer decision on the same case.',
  'Keep KPI claims scoped to measured cohort event data and visible limitations only.',
] as const;

export type PilotRequestSuccessCriteria = typeof PILOT_REQUEST_SUCCESS_CRITERIA;
