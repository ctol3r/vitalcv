'use client'

import {
  DISCOVERY_MODES,
  isModeAvailable,
  type DiscoveryContext,
  type DiscoveryMode,
} from '@/lib/matcha-deck/discoveryModes'

export interface DiscoveryModeBarProps {
  mode: DiscoveryMode
  onChange: (mode: DiscoveryMode) => void
  ctx: DiscoveryContext
}

/**
 * The discovery-mode selector (J6). Each mode is an intentional lens over the
 * same loaded recommendation set — a pure re-rank or filter, never a new fetch
 * or a fabricated ranking. The active mode's honest hint is shown below the row
 * so the clinician always knows what ordering they are looking at.
 */
export function DiscoveryModeBar({ mode, onChange, ctx }: DiscoveryModeBarProps) {
  const modes = DISCOVERY_MODES.filter((m) => isModeAvailable(m.mode, ctx))
  const active = modes.find((m) => m.mode === mode) ?? modes[0]

  return (
    <div className="mdk-modes" data-mdk-mode={mode}>
      <div className="mdk-modes-row" role="tablist" aria-label="Discovery mode">
        {modes.map((m) => (
          <button
            key={m.mode}
            type="button"
            role="tab"
            aria-selected={m.mode === mode}
            className="mdk-mode-chip"
            data-active={m.mode === mode ? 'true' : undefined}
            onClick={() => onChange(m.mode)}
          >
            {m.label}
          </button>
        ))}
      </div>
      {active ? (
        <p className="mdk-modes-hint" data-mdk-mode-hint>
          {active.hint}
        </p>
      ) : null}
    </div>
  )
}
