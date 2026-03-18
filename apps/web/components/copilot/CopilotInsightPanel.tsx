"use client";

import { Network } from 'lucide-react';

/**
 * Legacy CopilotInsightPanel — previously showed hardcoded mock data.
 * The real graph insight is now embedded in the Investigation Workbench
 * via GraphWorkbenchPanel. This stub exists for Storybook compatibility only.
 */
export function CopilotInsightPanel() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[var(--vt-surface)] p-8 text-center">
      <Network className="h-12 w-12 text-[var(--vt-text-3)]" />
      <h2 className="mt-4 text-sm font-semibold text-[var(--vt-text-1)]">
        Graph insight unavailable
      </h2>
      <p className="mt-2 max-w-xs text-xs leading-5 text-[var(--vt-text-3)]">
        Graph analysis is available inside the Investigation Workbench at /intelligence?view=investigations.
      </p>
    </div>
  );
}
