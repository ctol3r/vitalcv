'use client';

import { CheckCircle2 } from 'lucide-react';

export function ClearToStartBanner() {
  return (
    <div className="w-full bg-emerald-50 border-b border-emerald-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-emerald-900 tracking-tight">Clear to Start</span>
          <span className="text-xs text-emerald-700">All mandatory requirements verified and continuously monitored.</span>
        </div>
      </div>
    </div>
  );
}
