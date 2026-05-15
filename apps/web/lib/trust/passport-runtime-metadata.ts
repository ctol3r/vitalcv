export type PassportRuntimePostureStatus =
  | 'verified'
  | 'degraded'
  | 'pending'
  | 'unavailable'
  | 'unverifiable';

export interface PassportRuntimePosture {
  status: PassportRuntimePostureStatus;
  label: string;
  detail: string;
}

export interface PassportRuntimeMetadata {
  checkedAt: string;
  lineageKey: string;
  replayPosture: PassportRuntimePosture;
  continuityPosture: PassportRuntimePosture;
  issuerPosture: PassportRuntimePosture;
}

function postureLabel(status: PassportRuntimePostureStatus): string {
  switch (status) {
    case 'verified':
      return 'Available';
    case 'degraded':
      return 'Partially available';
    case 'pending':
      return 'Verification pending';
    case 'unavailable':
      return 'Unavailable';
    case 'unverifiable':
      return 'Unverifiable';
  }
}

export function buildPassportRuntimeMetadata(
  entityId: string,
  posture: {
    checkedAt?: string;
    replayPosture: Omit<PassportRuntimePosture, 'label'> & Partial<Pick<PassportRuntimePosture, 'label'>>;
    continuityPosture: Omit<PassportRuntimePosture, 'label'> & Partial<Pick<PassportRuntimePosture, 'label'>>;
    issuerPosture: Omit<PassportRuntimePosture, 'label'> & Partial<Pick<PassportRuntimePosture, 'label'>>;
  },
): PassportRuntimeMetadata {
  const checkedAt = posture.checkedAt ?? new Date().toISOString();

  return {
    checkedAt,
    lineageKey: `passport:${entityId}`,
    replayPosture: {
      status: posture.replayPosture.status,
      label: posture.replayPosture.label ?? postureLabel(posture.replayPosture.status),
      detail: posture.replayPosture.detail,
    },
    continuityPosture: {
      status: posture.continuityPosture.status,
      label: posture.continuityPosture.label ?? postureLabel(posture.continuityPosture.status),
      detail: posture.continuityPosture.detail,
    },
    issuerPosture: {
      status: posture.issuerPosture.status,
      label: posture.issuerPosture.label ?? postureLabel(posture.issuerPosture.status),
      detail: posture.issuerPosture.detail,
    },
  };
}
