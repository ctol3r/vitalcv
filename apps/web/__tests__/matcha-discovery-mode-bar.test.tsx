import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { DiscoveryModeBar } from '@/components/matcha-deck/DiscoveryModeBar'

const noop = () => {}

describe('DiscoveryModeBar (J6)', () => {
  it('renders every context-free mode and marks the active one', () => {
    const html = renderToStaticMarkup(
      <DiscoveryModeBar mode="ready_sooner" onChange={noop} ctx={{}} />,
    )
    expect(html).toContain('For you')
    expect(html).toContain('Ready sooner')
    expect(html).toContain('Best pay')
    expect(html).toContain('Remote')
    expect(html).toContain('New')
    // active mode is selected
    expect(html).toContain('aria-selected="true"')
    // and shows the active mode's honest hint
    expect(html).toContain('Fewer currently visible readiness gaps')
  })

  it('hides Near me when no home location is known', () => {
    const html = renderToStaticMarkup(<DiscoveryModeBar mode="for_you" onChange={noop} ctx={{}} />)
    expect(html).not.toContain('Near me')
  })

  it('shows Near me when a home state is known', () => {
    const html = renderToStaticMarkup(
      <DiscoveryModeBar mode="for_you" onChange={noop} ctx={{ homeState: 'CA' }} />,
    )
    expect(html).toContain('Near me')
  })

  it('the Ready sooner hint never promises faster credentialing', () => {
    const html = renderToStaticMarkup(
      <DiscoveryModeBar mode="ready_sooner" onChange={noop} ctx={{}} />,
    )
    expect(html).toContain('not a promise of faster credentialing')
  })
})
