'use client';

import { openPilotReporter } from '@/lib/pilot-ops/client';

export default function FeedbackButton() {
  return (
    <button
      onClick={() => openPilotReporter({ kind: 'feedback' })}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-medium text-white shadow-lg transition-all hover:scale-105 hover:bg-slate-800 active:scale-95"
      aria-label="Send feedback"
      type="button"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
      Feedback
    </button>
  );
}
