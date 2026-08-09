'use client';

import { usePathname } from 'next/navigation';
import { openPilotReporter } from '@/lib/pilot-ops/client';

export default function FeedbackButton() {
  const pathname = usePathname();

  // MATCHA Discover is a focused, one-handed workflow with its own sticky
  // controls and details sheet. The global floating affordance must not cover
  // or compete with those controls.
  if (
    pathname === '/holder/opportunities/discover'
    || pathname === '/dev/matcha-deck'
  ) {
    return null;
  }

  return (
    <button
      onClick={() => openPilotReporter({ kind: 'feedback' })}
      /* This is chrome and it is `fixed`, so it renders on EVERY page — which is
         why four separate violations here were worth more than their size:
         CD-10 (rounded-full pill, retired), CD-3 (bg-slate-900 — the cool slate
         explicitly retired in favour of warm ink), CD-11 (hover:scale-105 /
         active:scale-95 is scale theatre; motion is opacity-preferred and
         displacement is capped at 8px), and CD-15 (py-2.5 at text-xs computed to
         ~34px, under the 44px floor).
         The float shadow stays: CD-12 permits exactly one, reserved for a
         detached floating rail, and this is that.
         Below md the label is dropped and the chip collapses to a 44px square:
         at 390pt the labeled chip spans ~109px of the bottom-right corner and
         was measured sitting on top of centered tappable content (DL-001) —
         the accessible name lives in aria-label, so the visible label is
         presentation, not the control's name.
         Below md it also rides ABOVE the public chrome's bottom-pinned control
         cluster (eyebrow.css pins it at 20px, 40px tall): at the old bottom-6
         it landed directly on the Start action. */
      className="fixed bottom-[76px] right-6 z-40 flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-[10px] bg-[var(--vt-text-primary)] px-3 py-2.5 text-xs font-medium text-[var(--vt-surface)] shadow-lg transition-colors duration-[120ms] hover:bg-[var(--vt-accent)] motion-reduce:transition-none md:bottom-6 md:px-4"
      aria-label="Send feedback"
      type="button"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
      <span className="hidden md:inline">Feedback</span>
    </button>
  );
}
