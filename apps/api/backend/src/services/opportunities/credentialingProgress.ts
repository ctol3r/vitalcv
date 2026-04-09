export type LaneProgress = 'complete' | 'pending' | 'missing' | 'in_progress';

export interface CredentialingProgress {
  identity: LaneProgress;
  sanctions: LaneProgress;
  licensure: LaneProgress;
  enrollment: LaneProgress;
}

export function calculateETA(progress: CredentialingProgress): string {
  if (progress.enrollment === 'missing' || progress.enrollment === 'in_progress' || progress.enrollment === 'pending') {
    return '45–90 days';
  }
  if (progress.licensure === 'missing' || progress.licensure === 'in_progress' || progress.licensure === 'pending') {
    return '14–30 days';
  }
  if (progress.sanctions === 'missing' || progress.sanctions === 'in_progress' || progress.sanctions === 'pending') {
    return '1–30 days'; // monthly
  }
  if (progress.identity === 'missing' || progress.identity === 'in_progress' || progress.identity === 'pending') {
    return 'instant';
  }
  return 'Ready';
}
