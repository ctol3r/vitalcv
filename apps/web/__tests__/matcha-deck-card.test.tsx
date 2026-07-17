import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { MatchaDeckCard } from '@/components/matcha-deck/MatchaDeckCard'
import { FIXTURE_RECOMMENDATIONS } from '@/components/matcha-deck/fixtures'

const byId = (id: string) => {
  const rec = FIXTURE_RECOMMENDATIONS.find((r) => r.recommendationId === id)
  if (!rec) throw new Error(`fixture missing: ${id}`)
  return rec
}

describe('MATCHA deck card face — honest rendering', () => {
  it('remote roles without a city never render "Remote · Remote"', () => {
    const html = renderToStaticMarkup(<MatchaDeckCard recommendation={byId('fx-rec-003')} />)
    expect(html).not.toContain('Remote · Remote')
    expect(html).toContain('Remote')
  })

  it('onsite roles render location and arrangement together', () => {
    const html = renderToStaticMarkup(<MatchaDeckCard recommendation={byId('fx-rec-001')} />)
    expect(html).toContain('Mountain View, CA · Onsite')
    expect(html).toContain('$310K–$345K')
  })

  it('missing compensation renders an explicit unknown, never a number', () => {
    const html = renderToStaticMarkup(<MatchaDeckCard recommendation={byId('fx-rec-003')} />)
    expect(html).toContain('Compensation not provided')
    expect(html).not.toContain('$0')
  })

  it('stale listings carry the stale freshness treatment', () => {
    const html = renderToStaticMarkup(<MatchaDeckCard recommendation={byId('fx-rec-005')} />)
    expect(html).toContain('mdk-freshness--stale')
    expect(html).toContain('Posted 6 weeks ago (sample)')
  })

  it('fixture cards always carry the Sample chip', () => {
    for (const rec of FIXTURE_RECOMMENDATIONS) {
      const html = renderToStaticMarkup(<MatchaDeckCard recommendation={rec} />)
      expect(html).toContain('mdk-chip--sample')
    }
  })
})
