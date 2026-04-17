import type { Metadata } from 'next';
import { Suspense } from 'react';
import ReadinessSurface from './ReadinessSurface';

export const metadata: Metadata = {
  title: 'Readiness — VitalCV',
  description: 'Source-backed readiness state. Every lane, every status, every limitation.',
};

export default function HolderReadinessPage() {
  return (
    <Suspense fallback={<ReadinessLoading />}>
      <ReadinessSurface />
    </Suspense>
  );
}

function ReadinessLoading() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-ping mx-auto" />
        <p className="font-mono text-sm text-slate-400">Initializing readiness check…</p>
      </div>
    </div>
  );
}
