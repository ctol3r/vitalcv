import { ReadinessStatus, RequirementEvidence } from '../employer/models';

export function determineReadinessStatus(
  requirements: RequirementEvidence[],
): ReadinessStatus {
  if (requirements.some((req) => req.status === 'NOT_MET')) {
    return 'NOT_READY';
  }
  if (requirements.some((req) => req.status === 'PARTIAL')) {
    return 'ALMOST_READY';
  }
  return 'READY';
}
