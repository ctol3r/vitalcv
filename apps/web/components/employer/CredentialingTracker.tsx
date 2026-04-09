import React from 'react';

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
    return '1–30 days';
  }
  if (progress.identity === 'missing' || progress.identity === 'in_progress' || progress.identity === 'pending') {
    return 'instant';
  }
  return 'Ready';
}

export default function CredentialingTracker({ progress }: { progress: CredentialingProgress }) {
  const eta = calculateETA(progress);
  
  return (
    <div className="p-6 border rounded-lg shadow-sm bg-background">
      <h2 className="text-xl font-bold mb-4">Credentialing Progress</h2>
      <div className="space-y-2 mb-6">
        <div className="flex justify-between">
          <span>Identity:</span> <span className="font-semibold">{progress.identity}</span>
        </div>
        <div className="flex justify-between">
          <span>Sanctions:</span> <span className="font-semibold">{progress.sanctions}</span>
        </div>
        <div className="flex justify-between">
          <span>Licensure:</span> <span className="font-semibold">{progress.licensure}</span>
        </div>
        <div className="flex justify-between">
          <span>Enrollment:</span> <span className="font-semibold">{progress.enrollment}</span>
        </div>
      </div>
      <div className="p-4 bg-muted rounded font-medium">
        Estimated time to start: {eta}
      </div>
    </div>
  );
}
