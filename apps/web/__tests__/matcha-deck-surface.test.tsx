// @vitest-environment jsdom

/**
 * MATCHA Deck surface tests (PR J1).
 *
 * Runs the real DiscoverSurface (fixture source) under jsdom with reduced
 * motion forced on, so decisions commit instantly and semantics can be
 * asserted synchronously: buttons duplicate every gesture, keyboard works,
 * undo restores the exact card, details preserve deck position, the live
 * region announces, and signals are emitted exactly once per intent.
 * Drag physics are exercised in a real browser (dev harness + e2e), not here.
 */

import * as React from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DiscoverSurface } from '@/components/matcha-deck/DiscoverSurface'
import { FIXTURE_RECOMMENDATIONS } from '@/components/matcha-deck/fixtures'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Force reduced motion: instant commits, no flight animations in jsdom.
function stubMatchMedia() {
  const mql = (query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => mql(query),
  })
}

async function renderSurface() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(<DiscoverSurface />)
  })
  // Flush the async fixture load.
  await act(async () => {})
  return {
    container,
    unmount: async () => {
      await act(async () => {
        root.unmount()
      })
      container.remove()
    },
  }
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const match = Array.from(container.querySelectorAll('button')).find((b) =>
    (b.textContent ?? '').trim().toLowerCase().includes(label.toLowerCase()),
  )
  if (!match) throw new Error(`Button not found: ${label}`)
  return match as HTMLButtonElement
}

function stage(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('.mdk-stage')
  if (!el) throw new Error('Deck stage not found')
  return el
}

function status(container: HTMLElement): string {
  return container.querySelector('[role="status"][aria-live="polite"]')?.textContent ?? ''
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.click()
  })
}

async function key(el: HTMLElement, key: string) {
  await act(async () => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

function signals(): Array<{ action: string; recommendationId: string }> {
  return (window as unknown as { __mdkSignals?: Array<{ action: string; recommendationId: string }> })
    .__mdkSignals ?? []
}

describe('MATCHA Discover surface (fixtures, reduced motion)', () => {
  beforeEach(() => {
    stubMatchMedia()
    ;(window as unknown as { __mdkSignals?: unknown[] }).__mdkSignals = []
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders the sample banner, the first card, and a full action bar', async () => {
    const view = await renderSurface()
    const html = view.container.innerHTML

    expect(view.container.querySelector('[data-mdk-sample-banner]')).toBeTruthy()
    expect(html).toContain('Sample deck — these are not real listings')
    expect(stage(view.container).getAttribute('data-mdk-active')).toBe('fx-rec-001')
    expect(html).toContain('Hospitalist')
    expect(html).toContain('Sample Health System')
    expect(html).toContain('$310K–$345K')

    expect(button(view.container, 'Undo').disabled).toBe(true)
    expect(button(view.container, 'Pass').disabled).toBe(false)
    expect(button(view.container, 'Details').disabled).toBe(false)
    expect(button(view.container, 'Interested').disabled).toBe(false)
    expect(button(view.container, 'Priority').disabled).toBe(false)

    // The deck emitted a viewed signal for the first card, exactly once.
    expect(signals().filter((s) => s.action === 'viewed')).toHaveLength(1)
    await view.unmount()
  })

  it('Interested advances the deck, announces, and emits exactly one interested signal', async () => {
    const view = await renderSurface()
    await click(button(view.container, 'Interested'))

    expect(stage(view.container).getAttribute('data-mdk-active')).toBe('fx-rec-002')
    expect(status(view.container)).toContain('Saved as Interested.')
    expect(status(view.container)).toContain('Opportunity 2 of 6')
    expect(signals().filter((s) => s.action === 'interested')).toHaveLength(1)

    // The interested queue rail shows the saved role.
    expect(view.container.innerHTML).toContain('Interested (1)')
    await view.unmount()
  })

  it('Undo restores the exact previous card and re-enables its decision', async () => {
    const view = await renderSurface()
    await click(button(view.container, 'Pass'))
    expect(stage(view.container).getAttribute('data-mdk-active')).toBe('fx-rec-002')

    await click(button(view.container, 'Undo'))
    expect(stage(view.container).getAttribute('data-mdk-active')).toBe('fx-rec-001')
    expect(status(view.container)).toContain('Undo complete.')
    expect(signals().filter((s) => s.action === 'restored')).toHaveLength(1)
    expect(button(view.container, 'Undo').disabled).toBe(true)
    await view.unmount()
  })

  it('keyboard drives every deck action: arrows, S, P, Z', async () => {
    const view = await renderSurface()
    const deckStage = stage(view.container)

    await key(deckStage, 'ArrowLeft')
    expect(status(view.container)).toContain('Passed.')
    expect(stage(view.container).getAttribute('data-mdk-active')).toBe('fx-rec-002')

    await key(deckStage, 's')
    expect(status(view.container)).toContain('Saved as Interested.')
    expect(stage(view.container).getAttribute('data-mdk-active')).toBe('fx-rec-003')

    await key(deckStage, 'z')
    expect(stage(view.container).getAttribute('data-mdk-active')).toBe('fx-rec-002')

    await key(deckStage, 'ArrowRight')
    expect(stage(view.container).getAttribute('data-mdk-active')).toBe('fx-rec-003')
    await view.unmount()
  })

  it('Details opens the full sheet, preserves deck position, and closes cleanly', async () => {
    const view = await renderSurface()
    await click(button(view.container, 'Details'))

    const dialog = view.container.querySelector('[role="dialog"]')
    expect(dialog).toBeTruthy()
    const sheetHtml = (dialog as HTMLElement).innerHTML
    expect(sheetHtml).toContain('Confirmed')
    expect(sheetHtml).toContain('Preferences')
    expect(sheetHtml).toContain('Needs review')
    expect(sheetHtml).toContain('Unknown')
    expect(sheetHtml).toContain('Compensation source')
    // Apply stays a separate, blocked transaction on sample data.
    expect(sheetHtml).toContain('Apply with VitalCV')
    expect(sheetHtml).toContain('Sample listing — Apply with VitalCV is available on live roles.')
    expect(signals().filter((s) => s.action === 'details_opened')).toHaveLength(1)

    await click(button(dialog as HTMLElement, 'Close'))
    expect(view.container.querySelector('[role="dialog"]')).toBeFalsy()
    // Deck position preserved.
    expect(stage(view.container).getAttribute('data-mdk-active')).toBe('fx-rec-001')
    await view.unmount()
  })

  it('deciding from the details sheet closes it and advances the deck', async () => {
    const view = await renderSurface()
    await click(button(view.container, 'Details'))
    const dialog = view.container.querySelector('[role="dialog"]') as HTMLElement
    await click(button(dialog, 'Priority'))

    expect(view.container.querySelector('[role="dialog"]')).toBeFalsy()
    expect(stage(view.container).getAttribute('data-mdk-active')).toBe('fx-rec-002')
    expect(signals().filter((s) => s.action === 'priority')).toHaveLength(1)
    await view.unmount()
  })

  it('exhausting the deck shows the caught-up state with real next steps', async () => {
    const view = await renderSurface()
    for (let i = 0; i < FIXTURE_RECOMMENDATIONS.length; i += 1) {
      await click(button(view.container, 'Pass'))
    }

    expect(stage(view.container).getAttribute('data-mdk-exhausted')).toBe('true')
    const html = view.container.innerHTML
    expect(html).toContain('You are caught up.')
    expect(html).toContain('href="/holder/opportunities"')
    expect(html).toContain('href="/holder/matcha/assessment"')
    expect(html).toContain('Nothing was shared with employers.')

    // Undo still works from the caught-up state.
    await click(button(view.container, 'Undo last decision'))
    expect(stage(view.container).getAttribute('data-mdk-exhausted')).toBe('false')
    expect(stage(view.container).getAttribute('data-mdk-active')).toBe('fx-rec-006')
    await view.unmount()
  })

  it('mode toggle links Discover and Search without dead routes', async () => {
    const view = await renderSurface()
    const toggle = view.container.querySelector('.mdk-mode-toggle') as HTMLElement
    expect(toggle.innerHTML).toContain('href="/holder/opportunities/discover"')
    expect(toggle.innerHTML).toContain('href="/holder/opportunities"')
    await view.unmount()
  })
})
