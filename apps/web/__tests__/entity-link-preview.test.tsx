// @vitest-environment jsdom

/**
 * EntityLink preview behavior (G3). Proves: intent past the delay fetches and
 * shows a preview; withdrawing before the delay cancels (no fetch); a plain
 * click pushes a pane instead of navigating; a 404 shows no card.
 *
 * The tests drive the FOCUS path (focusin/focusout on the anchor) rather than
 * hover: React does not fire onMouseEnter from a synthetic native dispatch in
 * jsdom, but it delegates onFocus/onBlur via focusin/focusout reliably. Focus
 * runs the identical beginPreview/endPreview code and is the keyboard-preview
 * path the directive requires; hover timing is covered by the e2e.
 */

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EntityLink } from '@/components/page-stack/EntityLink';
import type { PaneKey } from '@/lib/page-stack/types';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const pushSpy = vi.fn();
let currentParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  usePathname: () => '/dev/page-stack',
  useSearchParams: () => currentParams,
  useRouter: () => ({ push: pushSpy, replace: vi.fn(), prefetch: vi.fn() }),
}));

const OPP: PaneKey = { type: 'opportunity', id: 'opp_1' };
const PREVIEW = { type: 'opportunity', id: 'opp_1', title: 'Hospitalist', subtitle: 'El Camino' };

let container: HTMLDivElement;
let root: Root;
let fetchSpy: ReturnType<typeof vi.fn>;

function fetchReturning(status: number, body: unknown) {
  return vi.fn(async () => ({ status, json: async () => body }) as unknown as Response);
}

beforeEach(() => {
  vi.useFakeTimers();
  currentParams = new URLSearchParams();
  pushSpy.mockClear();
  fetchSpy = fetchReturning(200, PREVIEW);
  global.fetch = fetchSpy as unknown as typeof fetch;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

// A distinct id per test — the preview cache is module-level (one fetch per
// entity per page life, by design), so reusing an id would leak across tests.
let entityId = 'opp_1';
async function render(id = 'opp_1', relationship?: string) {
  entityId = id;
  await act(async () => {
    root.render(
      <EntityLink entity={{ type: 'opportunity', id }} relationship={relationship}>
        El Camino role
      </EntityLink>,
    );
  });
}

function link() {
  return container.querySelector(`[data-entity-link="opportunity:${entityId}"]`) as HTMLAnchorElement;
}

describe('EntityLink — hover preview', () => {
  it('fetches and shows a preview only after the hover delay', async () => {
    await render('opp_hover');
    await act(async () => {
      link().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
    // Before the delay: no fetch, no card.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(container.querySelector('[data-entity-preview]')).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {}); // flush the fetch microtask
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toContain('/api/entities/opportunity/opp_hover/preview');
    const card = container.querySelector('[data-entity-preview="ready"]');
    expect(card?.textContent).toContain('Hospitalist');
  });

  it('cancels when focus leaves before the delay — no fetch, no card', async () => {
    await render('opp_cancel');
    await act(async () => {
      link().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      vi.advanceTimersByTime(150);
      link().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      vi.advanceTimersByTime(300);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(container.querySelector('[data-entity-preview]')).toBeNull();
  });

  it('shows no card when the preview resolves 404 (absent/unauthorized)', async () => {
    fetchSpy = fetchReturning(404, { error: 'not_found' });
    global.fetch = fetchSpy as unknown as typeof fetch;
    await render('opp_404');
    await act(async () => {
      link().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      vi.advanceTimersByTime(300);
    });
    await act(async () => {});
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-entity-preview]')).toBeNull();
  });
});

describe('EntityLink — navigation', () => {
  it('a plain click pushes a pane instead of navigating away', async () => {
    await render();
    await act(async () => {
      link().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    });
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy.mock.calls[0][0]).toContain('pane=opportunity%3Aopp_1');
  });

  it('exposes a real href for cmd/middle-click and no-JS', async () => {
    await render();
    expect(link().getAttribute('href')).toContain('pane=opportunity%3Aopp_1');
  });

  it('connects relationship context through a supported accessible description', async () => {
    await render('opp_relationship', 'Recommended because the schedule matches your preferences.');
    const descriptionId = link().getAttribute('aria-describedby');

    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId!)?.textContent).toContain(
      'Recommended because the schedule matches your preferences.',
    );
  });
});
