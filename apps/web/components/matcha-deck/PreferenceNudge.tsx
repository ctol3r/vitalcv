'use client'

import type { PreferenceNudge as PreferenceNudgeData } from '@/lib/matcha-deck/preferenceNudges'

export interface PreferenceNudgeProps {
  nudge: PreferenceNudgeData
  pending: boolean
  onApply: () => void
  onDismiss: () => void
}

/**
 * A non-blocking preference suggestion (J6c). Appears after a clear pass
 * pattern, asks a question, and applies only on explicit confirmation — the
 * clinician stays in control. The `effect` line states honestly what applying
 * actually changes (it maps to an engine-backed field, so it genuinely
 * re-ranks). Dismiss silences it for the session.
 */
export function PreferenceNudge({ nudge, pending, onApply, onDismiss }: PreferenceNudgeProps) {
  return (
    <aside className="mdk-pref-nudge" role="status" data-mdk-pref-nudge={nudge.id}>
      <div className="mdk-pref-nudge-body">
        <p className="mdk-pref-nudge-q">{nudge.message}</p>
        <p className="mdk-pref-nudge-effect">{nudge.effect}</p>
      </div>
      <div className="mdk-pref-nudge-actions">
        <button type="button" className="mdk-btn mdk-btn--interested" onClick={onApply} disabled={pending}>
          {pending ? 'Saving…' : 'Yes, prefer remote'}
        </button>
        <button type="button" className="mdk-btn" onClick={onDismiss} disabled={pending}>
          Not now
        </button>
      </div>
    </aside>
  )
}
