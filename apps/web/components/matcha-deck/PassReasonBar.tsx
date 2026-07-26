'use client'

import { PASS_REASONS } from '@/lib/matcha-deck/passReasons'

/**
 * Non-blocking pass-reason prompt (PR J6b).
 *
 * Appears AFTER a qualifying pass, asking the optional "why". It is fixed-
 * positioned so it never reflows the deck (an in-flow bar would push the mobile
 * card under the sticky action bar). The deck stays fully interactive
 * underneath; every choice — a reason, skip, or opt-out — dismisses it. The
 * reason is private preference data and is never required.
 */
export interface PassReasonBarProps {
  /** The role just passed, for context. */
  roleTitle: string
  onPick: (reasonId: string) => void
  onSkip: () => void
  onDontAskAgain: () => void
}

export function PassReasonBar({ roleTitle, onPick, onSkip, onDontAskAgain }: PassReasonBarProps) {
  return (
    <section
      className="mdk-passreason"
      role="region"
      aria-label="Why did you pass on this role?"
      data-mdk-passreason="true"
    >
      <div className="mdk-passreason-head">
        <p className="mdk-passreason-q">
          Passed <strong>{roleTitle}</strong>. Why? <span className="mdk-passreason-opt">Optional</span>
        </p>
        <button type="button" className="mdk-passreason-close" onClick={onSkip} aria-label="Skip — don’t give a reason">
          Skip
        </button>
      </div>
      <ul className="mdk-passreason-reasons">
        {PASS_REASONS.map((r) => (
          <li key={r.id}>
            <button type="button" className="mdk-passreason-chip" onClick={() => onPick(r.id)}>
              {r.label}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="mdk-passreason-mute" onClick={onDontAskAgain}>
        Don’t ask again
      </button>
    </section>
  )
}
