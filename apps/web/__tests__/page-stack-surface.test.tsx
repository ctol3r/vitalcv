// @vitest-environment jsdom

/**
 * PageStack surface tests (G2).
 *
 * Proves the load-bearing contract: the URL is the source of truth. Clicking a
 * PaneLink pushes `?pane=type:id`; a URL that carries pane params derives the
 * panes; closing a pane rewrites the URL. next/navigation is mocked with a
 * mutable searchParams that router.push updates, so both directions are real.
 *
 * An injected trivial registry keeps this independent of the product surfaces
 * (and their data providers) — the shell behavior is what's under test.
 */

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PageStack } from '@/components/page-stack/PageStack';
import { PaneLink } from '@/components/page-stack/PaneLink';
import { PANE_GRAPH_NODE, type PaneKey, type PaneRegistry } from '@/lib/page-stack/types';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// ── Mutable URL state the mock reads and router.push writes ──────────────────
let currentParams = new URLSearchParams();
const pushSpy = vi.fn((url: string) => {
  const qs = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  currentParams = new URLSearchParams(qs);
});
const replaceSpy = vi.fn((url: string) => {
  const qs = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  currentParams = new URLSearchParams(qs);
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/holder/dev/page-stack',
  useSearchParams: () => currentParams,
  useRouter: () => ({ push: pushSpy, replace: replaceSpy, prefetch: vi.fn() }),
}));

// A trivial registry: each pane body just prints its id, tagged by type.
function bodyFor(type: string) {
  return function Body({ id }: { id: string }) {
    return <div data-testid={`body-${type}`}>{id}</div>;
  };
}
const testRegistry: PaneRegistry = {
  opportunity: { type: 'opportunity', graphNodeType: PANE_GRAPH_NODE.opportunity, Component: bodyFor('opportunity'), fallbackLabel: 'Opportunity' },
  employer: { type: 'employer', graphNodeType: PANE_GRAPH_NODE.employer, Component: bodyFor('employer'), fallbackLabel: 'Employer' },
  evidence_claim: { type: 'evidence_claim', graphNodeType: PANE_GRAPH_NODE.evidence_claim, Component: bodyFor('evidence_claim'), fallbackLabel: 'Evidence claim' },
};

let container: HTMLDivElement;
let root: Root;

async function render(node: React.ReactNode) {
  await act(async () => {
    root.render(node as React.ReactElement);
  });
}

beforeEach(() => {
  currentParams = new URLSearchParams();
  pushSpy.mockClear();
  replaceSpy.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const opp: PaneKey = { type: 'opportunity', id: 'opp_123' };

describe('PageStack — URL is the source of truth', () => {
  it('renders only the root when no pane params are present', async () => {
    await render(<PageStack registry={testRegistry} root={<div data-testid="root">root</div>} />);
    expect(container.querySelector('[data-testid="root"]')).not.toBeNull();
    expect(container.querySelector('[data-pane-index]')).toBeNull();
  });

  it('a link click pushes ?pane=type:id (and does not navigate away)', async () => {
    await render(
      <PageStack registry={testRegistry} root={<PaneLink paneKey={opp}>open</PaneLink>} />,
    );
    const link = container.querySelector('[data-pane-link="opportunity:opp_123"]') as HTMLAnchorElement;
    expect(link).not.toBeNull();

    await act(async () => {
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    });

    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy.mock.calls[0][0]).toContain('pane=opportunity%3Aopp_123');
  });

  it('derives a pane from pane params in the URL', async () => {
    currentParams = new URLSearchParams('pane=opportunity:opp_123');
    await render(<PageStack registry={testRegistry} root={<div>root</div>} />);
    const body = container.querySelector('[data-testid="body-opportunity"]');
    expect(body?.textContent).toBe('opp_123');
    expect(container.querySelectorAll('[data-pane-index]')).toHaveLength(1);
  });

  it('derives a multi-pane stack in URL order, rightmost focused', async () => {
    currentParams = new URLSearchParams('pane=opportunity:opp_1&pane=employer:org_2');
    await render(<PageStack registry={testRegistry} root={<div>root</div>} />);
    const panes = container.querySelectorAll('[data-pane-index]');
    expect(panes).toHaveLength(2);
    expect(panes[0].getAttribute('data-pane-focused')).toBe('false');
    expect(panes[1].getAttribute('data-pane-focused')).toBe('true');
  });

  it('closing the newest pane rewrites the URL without it', async () => {
    currentParams = new URLSearchParams('pane=opportunity:opp_1&pane=employer:org_2');
    await render(<PageStack registry={testRegistry} root={<div>root</div>} />);
    const closeButtons = container.querySelectorAll('button[aria-label^="Close"]');
    const closeNewest = closeButtons[closeButtons.length - 1] as HTMLButtonElement;

    await act(async () => {
      closeNewest.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    });

    expect(pushSpy).toHaveBeenCalledTimes(1);
    const nextUrl = pushSpy.mock.calls[0][0];
    expect(nextUrl).toContain('pane=opportunity%3Aopp_1');
    expect(nextUrl).not.toContain('org_2');
  });

  it('drops an unknown pane type instead of rendering it', async () => {
    currentParams = new URLSearchParams('pane=wallet:me&pane=opportunity:opp_1');
    await render(<PageStack registry={testRegistry} root={<div>root</div>} />);
    // 'wallet' is a real graph node but not a pane type — only the opportunity resolves.
    expect(container.querySelectorAll('[data-pane-index]')).toHaveLength(1);
    expect(container.querySelector('[data-testid="body-opportunity"]')?.textContent).toBe('opp_1');
  });
});
