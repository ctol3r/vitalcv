// @vitest-environment jsdom

/**
 * RelationshipDrawer (G4) — tab switching, context rendering, honest empty
 * states, and that the same node's state chip surfaces. Rendered directly with
 * projected relationship views (no network).
 */

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RelationshipDrawer } from '@/components/page-stack/RelationshipDrawer';
import type { RelationshipView } from '@/lib/entity-relationships/project';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const outgoing: RelationshipView[] = [
  {
    id: 'r1',
    direction: 'outgoing',
    type: 'HOLDS_LICENSE',
    label: 'Holds license',
    node: { id: 'evidence:lic', type: 'evidence', label: 'California Medical License', state: 'gated' },
    evidenceId: 'ev1',
  },
];
const backlinks: RelationshipView[] = [
  {
    id: 'r2',
    direction: 'backlink',
    type: 'VERIFIED_BY',
    label: 'Verifies',
    node: { id: 'source:nppes', type: 'source', label: 'NPPES' },
    evidenceId: null,
  },
];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function render(node: React.ReactNode) {
  await act(async () => root.render(node as React.ReactElement));
}
function click(el: Element | null) {
  return act(async () => {
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  });
}

describe('RelationshipDrawer', () => {
  it('shows outgoing by default with label, node, and state chip', async () => {
    await render(<RelationshipDrawer outgoing={outgoing} backlinks={backlinks} />);
    const list = container.querySelector('[data-rel-list="outgoing"]');
    expect(list?.textContent).toContain('Holds license');
    expect(list?.textContent).toContain('California Medical License');
    expect(list?.textContent).toContain('gated'); // state chip surfaced, never hidden
    // Tab counts reflect both directions.
    expect(container.textContent).toContain('Outgoing (1)');
    expect(container.textContent).toContain('Backlinks (1)');
  });

  it('switches to backlinks on tab click, showing inverse phrasing', async () => {
    await render(<RelationshipDrawer outgoing={outgoing} backlinks={backlinks} />);
    const backlinkTab = Array.from(container.querySelectorAll('[role="tab"]')).find((t) =>
      t.textContent?.includes('Backlinks'),
    );
    await click(backlinkTab!);
    expect(container.querySelector('[data-rel-list="backlinks"]')?.textContent).toContain('Verifies');
    expect(container.querySelector('[data-rel-list="backlinks"]')?.textContent).toContain('NPPES');
    expect(container.querySelector('[data-rel-list="outgoing"]')).toBeNull();
  });

  it('shows an honest empty state, never a fabricated connection', async () => {
    await render(<RelationshipDrawer outgoing={[]} backlinks={[]} />);
    expect(container.querySelector('[data-rel-empty="outgoing"]')?.textContent).toContain('No outgoing links');
    expect(container.querySelector('[data-rel-list]')).toBeNull();
  });

  it('shows a loading state without inventing rows', async () => {
    await render(<RelationshipDrawer outgoing={[]} backlinks={[]} loading />);
    expect(container.textContent).toContain('Loading relationships');
    expect(container.querySelector('[data-rel-list]')).toBeNull();
  });
});
