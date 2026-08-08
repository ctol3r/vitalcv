'use client';

import { WORKBENCH_BRANDING } from '@/lib/career-garden/branding';

/**
 * Contextual "Capture in Workbench" action — CC-09 / WB-05.
 *
 * A tiny dispatcher: raises the dock's capture event with a context label so
 * the clinician can jot a private thought about the thing on screen without
 * leaving it. Renders only where the dock exists (holder chrome); it holds
 * no data and performs no fetch — the dock and its proxies own persistence.
 */
export function CaptureInWorkbench({ context, className }: { context: string; className?: string }) {
  return (
    <button
      type="button"
      data-capture-in-workbench
      className={className ?? 'mz-btn-ghost mz-btn-sm'}
      style={{ minHeight: 44 }}
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent('vitalcv:workbench-capture', { detail: { context } }),
        );
      }}
    >
      Capture in {WORKBENCH_BRANDING.shortName}
    </button>
  );
}
