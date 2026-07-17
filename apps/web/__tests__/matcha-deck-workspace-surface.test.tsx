// @vitest-environment jsdom

import * as React from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { InterestedWorkspaceSurface } from '@/components/matcha-deck/InterestedWorkspaceSurface'
import { PassedWorkspaceSurface } from '@/components/matcha-deck/PassedWorkspaceSurface'
import { FIXTURE_RECOMMENDATIONS } from '@/components/matcha-deck/fixtures'
import { buildDeckWorkspaces } from '@/lib/matcha-deck/workspace'
import type { DeckDecisionDetail } from '@/lib/matcha/opportunitySignals'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

async function renderNode(node: React.ReactNode) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => root.render(node))
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

const recs = FIXTURE_RECOMMENDATIONS
const oppId = (i: number) => recs[i].opportunity.opportunityId
const d = (over: Partial<DeckDecisionDetail> & { opportunityId: string; decision: DeckDecisionDetail['decision'] }): DeckDecisionDetail => ({
  opportunityVersion: null,
  recommendationId: null,
  decidedAt: '2026-07-16T10:00:00Z',
  ...over,
})

describe('InterestedWorkspaceSurface', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })
  globalThis.IS_REACT_ACT_ENVIRONMENT = true

  it('signed-out shows a sign-in prompt, no roles', async () => {
    const view = await renderNode(<InterestedWorkspaceSurface signedIn={false} items={[]} />)
    expect(view.container.textContent).toContain('Sign in to see the roles')
    await view.unmount()
  })

  it('empty signed-in shows the honest empty state linking to Discover', async () => {
    const view = await renderNode(<InterestedWorkspaceSurface signedIn items={[]} />)
    expect(view.container.textContent).toContain('No saved roles yet')
    expect(view.container.querySelector('a[href="/holder/opportunities/discover"]')).toBeTruthy()
    await view.unmount()
  })

  it('renders priority-first, with a compare control when 2+ roles', async () => {
    const { interested } = buildDeckWorkspaces(
      [
        d({ opportunityId: oppId(0), decision: 'interested', opportunityVersion: recs[0].opportunityVersion, decidedAt: '2026-07-16T10:00:00Z' }),
        d({ opportunityId: oppId(3), decision: 'priority', opportunityVersion: recs[3].opportunityVersion, decidedAt: '2026-07-15T10:00:00Z' }),
      ],
      recs,
    )
    const view = await renderNode(<InterestedWorkspaceSurface signedIn items={interested} />)
    const roles = [...view.container.querySelectorAll('.mdk-ws-role')].map((n) => n.textContent)
    expect(roles[0]).toBe(recs[3].opportunity.title) // priority first
    expect(view.container.textContent).toContain('Compare 2 roles')
    await view.unmount()
  })

  it('a changed role is labeled; an unavailable role never invents content', async () => {
    const { interested } = buildDeckWorkspaces(
      [
        d({ opportunityId: oppId(0), decision: 'interested', opportunityVersion: 'STALE' }),
        d({ opportunityId: 'gone-opp', decision: 'interested', opportunityVersion: 'v1' }),
      ],
      recs,
    )
    const view = await renderNode(<InterestedWorkspaceSurface signedIn items={interested} />)
    expect(view.container.textContent).toContain('Changed since you saved it')
    expect(view.container.textContent).toContain('No longer in your matches')
    expect(view.container.textContent).toContain('never swaps it for a different listing')
    await view.unmount()
  })
})

describe('PassedWorkspaceSurface', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('shows restore controls for passed roles', async () => {
    const { passed } = buildDeckWorkspaces([d({ opportunityId: oppId(1), decision: 'passed' })], recs)
    const view = await renderNode(<PassedWorkspaceSurface signedIn items={passed} />)
    expect(view.container.textContent).toContain('Restore to deck')
    await view.unmount()
  })

  it('empty passed history explains a pass is not a dead end', async () => {
    const view = await renderNode(<PassedWorkspaceSurface signedIn items={[]} />)
    expect(view.container.textContent).toContain('Nothing passed yet')
    await view.unmount()
  })
})
