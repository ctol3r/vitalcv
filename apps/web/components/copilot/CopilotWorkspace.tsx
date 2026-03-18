"use client";

import Link from 'next/link';
import { MessageSquareMore } from 'lucide-react';

/**
 * Legacy CopilotWorkspace — the copilot is now embedded in the
 * Intelligence Console's investigation workbench at /intelligence?view=investigations.
 * This component renders a redirect notice for any stale references.
 */
export function CopilotWorkspace() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[var(--vt-surface)] text-[var(--vt-text-1)]">
      <div className="max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)]">
          <MessageSquareMore className="h-8 w-8 text-[var(--vt-text-3)]" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Copilot has moved</h1>
          <p className="text-sm leading-6 text-[var(--vt-text-2)]">
            The Copilot is now embedded in the Investigation Workbench inside the Intelligence Console.
          </p>
        </div>
        <Link
          href="/intelligence?view=investigations"
          className="inline-flex items-center rounded-full bg-cyan-400 px-6 py-2.5 text-sm font-semibold text-slate-950 transition hover:opacity-90"
        >
          Open Investigation Workbench
        </Link>
      </div>
    </div>
  );
}
