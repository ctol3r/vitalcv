import { CredentialingProgress, LaneProgress } from '../../domain/entity/vcvApplication';

export type LaneData = {
  status: LaneProgress;
  source?: string;
};

export type ApplicationLanes = {
  identity: LaneData;   // NPPES
  sanctions: LaneData;  // OIG
  licensure: LaneData;  // state board
  enrollment: LaneData; // PECOS
};

export function buildProgress(lanes: ApplicationLanes): CredentialingProgress {
  return {
    identity: lanes.identity?.status || 'missing',
    sanctions: lanes.sanctions?.status || 'missing',
    licensure: lanes.licensure?.status || 'missing',
    enrollment: lanes.enrollment?.status || 'missing',
  };
}

export function buildHumanReadableSummary(progress: CredentialingProgress): string {
  const parts: string[] = [];

  const mapStatusToText = (laneName: string, status: LaneProgress) => {
    switch (status) {
      case 'complete': return `${laneName} verified.`;
      case 'missing': return `${laneName} missing.`;
      case 'in_progress': return `${laneName} in progress.`;
      case 'pending': return `${laneName} pending.`;
      default: return `${laneName} unknown.`;
    }
  };

  parts.push(mapStatusToText('Identity', progress.identity));
  parts.push(mapStatusToText('Sanctions', progress.sanctions));
  parts.push(mapStatusToText('Licensure', progress.licensure));
  parts.push(mapStatusToText('Enrollment', progress.enrollment));

  return parts.join(' ');
}
