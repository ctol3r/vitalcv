import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { DeckDetailSheet } from '@/components/matcha-deck/DeckDetailSheet'
import { FIXTURE_RECOMMENDATIONS } from '@/components/matcha-deck/fixtures'
import type { DeckRecommendation } from '@/components/matcha-deck/types'

const noop = () => {}

/** A live (non-fixture) recommendation that is clear to apply. */
function liveApplyable(): DeckRecommendation {
  const base = FIXTURE_RECOMMENDATIONS[0]
  return {
    ...base,
    isFixture: false,
    opportunity: { ...base.opportunity, opportunityId: 'opp-live-1' },
    actions: { canExpressInterest: true, canApply: true },
  }
}

describe('MATCHA deck detail sheet — apply handoff (J5)', () => {
  it('routes an applyable role to the consent surface, never a direct submit', () => {
    const html = renderToStaticMarkup(
      <DeckDetailSheet recommendation={liveApplyable()} onClose={noop} onDecide={noop} />,
    )
    // A link to the ?apply= consent modal — the only surface that shows evidence
    // preview and represents consent. It must be an anchor, not a submit button.
    expect(html).toContain('href="/holder/opportunities?apply=opp-live-1"')
    expect(html).toContain('Apply with VitalCV')
  })

  it('keeps Apply disabled for a sample/fixture listing', () => {
    const fixture = FIXTURE_RECOMMENDATIONS[0] // fixtures force canApply:false
    const html = renderToStaticMarkup(
      <DeckDetailSheet recommendation={fixture} onClose={noop} onDecide={noop} />,
    )
    expect(html).toContain('disabled')
    // No apply link is minted for a sample listing.
    expect(html).not.toContain('href="/holder/opportunities?apply=')
    expect(html).toContain('Sample listing')
  })

  it('keeps Apply disabled when the recommendation cannot apply, with the block reason', () => {
    const blocked: DeckRecommendation = {
      ...liveApplyable(),
      actions: {
        canExpressInterest: true,
        canApply: false,
        applyBlockReason: 'Specialty mismatch needs review before applying.',
      },
    }
    const html = renderToStaticMarkup(
      <DeckDetailSheet recommendation={blocked} onClose={noop} onDecide={noop} />,
    )
    expect(html).not.toContain('href="/holder/opportunities?apply=')
    expect(html).toContain('Specialty mismatch needs review')
  })

  it('always states that applying is a separate, consented step', () => {
    const html = renderToStaticMarkup(
      <DeckDetailSheet recommendation={liveApplyable()} onClose={noop} onDecide={noop} />,
    )
    expect(html).toContain('applying stays a separate step with evidence preview and')
  })
})
