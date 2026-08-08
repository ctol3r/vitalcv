// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * CC-07 / WB-03 — the Workbench spatial shell.
 *
 * Interaction contract (jsdom, the holder-chrome pattern this repo uses so
 * Clerk is never weakened for tests): trigger, drawer, pane stack, Escape
 * and Back semantics, unsaved-draft protection, honest unavailable state,
 * mobile sheet mode, reduced-motion collapse. Plus the mount closure: the
 * dock is imported by exactly one component — the clinician chrome — so it
 * cannot appear on public, employer-marketing, or employer-app routes.
 */

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let currentPath = '/holder/home';
vi.mock('next/navigation', () => ({
  usePathname: () => currentPath,
}));

import { WorkbenchDock } from '@/components/workbench/WorkbenchDock';

const WEB_ROOT = join(__dirname, '..');

let container: HTMLElement | null = null;
let root: Root | null = null;
let matchMediaState = { reduced: false, narrow: false };

function mockMatchMedia() {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion')
      ? matchMediaState.reduced
      : query.includes('max-width')
        ? matchMediaState.narrow
        : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

const NOTES = [
  { id: 'n1', title: 'First note', body: 'Body one', tags: [], status: 'unfiled', createdAt: '2026-08-01' },
  { id: 'n2', title: 'Second note', body: 'Body two', tags: [], status: 'growing', createdAt: '2026-08-02' },
];

function mockFetch(ok = true) {
  const fn = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    if (!ok) return { ok: false, status: 503, json: async () => ({}) } as Response;
    if (init?.method === 'POST') {
      return { ok: true, status: 201, json: async () => ({ note: NOTES[0] }) } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ notes: NOTES }) } as Response;
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

async function typeInto(textarea: HTMLTextAreaElement, text: string) {
  // React 19 tracks controlled values through its own descriptor; drive the
  // native setter so the change actually reaches state.
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(textarea, text);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<WorkbenchDock />);
  });
}

async function openDrawer() {
  const trigger = document.querySelector('[data-workbench-trigger]') as HTMLButtonElement;
  await act(async () => {
    trigger.click();
  });
}

beforeEach(() => {
  currentPath = '/holder/home';
  matchMediaState = { reduced: false, narrow: false };
  mockMatchMedia();
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/holder/home');
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
  vi.restoreAllMocks();
});

describe('mount closure — the dock cannot reach public or employer surfaces', () => {
  it('is imported by exactly one production component: the clinician chrome', () => {
    const importers: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (['node_modules', '.next', '_archive', '__tests__'].some((skip) => name === skip || name.startsWith('.next'))) continue;
        const full = join(dir, name);
        const stats = statSync(full);
        if (stats.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(name) && readFileSync(full, 'utf8').includes('components/workbench/WorkbenchDock')) {
          importers.push(full.replace(WEB_ROOT + '/', ''));
        }
      }
    };
    walk(join(WEB_ROOT, 'app'));
    walk(join(WEB_ROOT, 'components'));
    expect(importers).toEqual(['components/holder/HolderWorkspaceFrame.tsx']);
  });

  it('does not render on /holder/garden/* — the workspace and its Cursor own that surface', async () => {
    currentPath = '/holder/garden/notes';
    mockFetch();
    await mount();
    expect(document.querySelector('[data-workbench-trigger]')).toBeNull();
  });
});

describe('drawer basics', () => {
  it('opens from the trigger, loads notes, and moves focus into the dialog', async () => {
    mockFetch();
    await mount();
    await openDrawer();
    const drawer = document.querySelector('[data-workbench-drawer]') as HTMLElement;
    expect(drawer).not.toBeNull();
    expect(drawer.getAttribute('data-mode')).toBe('drawer');
    expect(document.activeElement).toBe(drawer);
    expect(drawer.textContent).toContain('First note');
    expect(drawer.textContent).toContain('VitalCV Workbench');
  });

  it('renders the honest unavailable state and disables capture when storage is down', async () => {
    mockFetch(false);
    await mount();
    await openDrawer();
    const drawer = document.querySelector('[data-workbench-drawer]') as HTMLElement;
    expect(drawer.querySelector('[data-workbench-unavailable]')?.textContent).toContain(
      'Workbench storage is temporarily unavailable',
    );
    const textarea = drawer.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
  });

  it('a failed save keeps the draft and shows an error — never a fake success', async () => {
    const fn = mockFetch();
    await mount();
    await openDrawer();
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    await typeInto(textarea, 'A thought after rounds');
    fn.mockImplementationOnce(async () => ({ ok: false, status: 503, json: async () => ({}) }) as Response);
    const save = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Save note')!;
    await act(async () => {
      save.click();
    });
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('your draft is still here');
    expect((document.querySelector('textarea') as HTMLTextAreaElement).value).toBe('A thought after rounds');
  });
});

describe('unsaved-draft protection', () => {
  it('close with a dirty draft asks first; cancel keeps the drawer and the text', async () => {
    mockFetch();
    await mount();
    await openDrawer();
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    await typeInto(textarea, 'unsaved thought');
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const close = Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('aria-label') === 'Close Workbench')!;
    await act(async () => {
      close.click();
    });
    expect(confirmSpy).toHaveBeenCalledWith('Discard your unsaved note draft?');
    expect(document.querySelector('[data-workbench-drawer]')).not.toBeNull();
    expect((document.querySelector('textarea') as HTMLTextAreaElement).value).toBe('unsaved thought');

    confirmSpy.mockReturnValue(true);
    await act(async () => {
      close.click();
    });
    expect(document.querySelector('[data-workbench-drawer]')).toBeNull();
    // Focus returns to the trigger after close.
    expect(document.activeElement).toBe(document.querySelector('[data-workbench-trigger]'));
  });

  it('a clean drawer closes without asking', async () => {
    mockFetch();
    await mount();
    await openDrawer();
    const confirmSpy = vi.spyOn(window, 'confirm');
    const close = Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('aria-label') === 'Close Workbench')!;
    await act(async () => {
      close.click();
    });
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(document.querySelector('[data-workbench-drawer]')).toBeNull();
  });
});

describe('pane stack, Back, and Escape', () => {
  it('opening a note pushes a history entry and the wb param; Back closes the latest pane', async () => {
    mockFetch();
    await mount();
    await openDrawer();
    const noteButton = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'First note')!;
    await act(async () => {
      noteButton.click();
    });
    expect(new URLSearchParams(window.location.search).get('wb')).toBe('n1');
    expect(document.querySelector('[data-workbench-pane="n1"]')).not.toBeNull();

    // Back (popstate) closes the pane and returns to the list.
    await act(async () => {
      window.history.replaceState(null, '', '/holder/home'); // what back() lands on
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(document.querySelector('[data-workbench-pane="n1"]')).toBeNull();
    expect(document.querySelector('textarea')).not.toBeNull();
  });

  it('Escape closes the topmost pane first, then the drawer', async () => {
    mockFetch();
    await mount();
    await openDrawer();
    const drawer = document.querySelector('[data-workbench-drawer]') as HTMLElement;
    const noteButton = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'First note')!;
    await act(async () => {
      noteButton.click();
    });
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {
      window.history.replaceState(null, '', '/holder/home');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await act(async () => {
      drawer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(backSpy).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-workbench-pane="n1"]')).toBeNull();
    expect(document.querySelector('[data-workbench-drawer]')).not.toBeNull();

    await act(async () => {
      drawer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(document.querySelector('[data-workbench-drawer]')).toBeNull();
  });

  it('restores an open pane stack from the URL on mount', async () => {
    window.history.replaceState(null, '', '/holder/home?wb=n2');
    mockFetch();
    await mount();
    expect(document.querySelector('[data-workbench-drawer]')).not.toBeNull();
    expect(document.querySelector('[data-workbench-pane="n2"]')).not.toBeNull();
  });
});

describe('viewport and motion composition', () => {
  it('narrow viewports get the bottom sheet with an Expand control', async () => {
    matchMediaState.narrow = true;
    mockFetch();
    await mount();
    await openDrawer();
    const drawer = document.querySelector('[data-workbench-drawer]') as HTMLElement;
    expect(drawer.getAttribute('data-mode')).toBe('sheet');
    const expand = Array.from(drawer.querySelectorAll('button')).find((b) => b.textContent === 'Expand')!;
    await act(async () => {
      expand.click();
    });
    expect(drawer.getAttribute('data-expanded')).toBe('true');
    expect(drawer.getAttribute('aria-modal')).toBe('true');
  });

  it('prefers-reduced-motion collapses the transition entirely', async () => {
    matchMediaState.reduced = true;
    mockFetch();
    await mount();
    await openDrawer();
    const drawer = document.querySelector('[data-workbench-drawer]') as HTMLElement;
    expect(drawer.getAttribute('data-reduced-motion')).toBe('true');
    expect(drawer.style.transition).toBe('none');
  });

  it('desktop drawer exposes the resize handle and the pin control', async () => {
    mockFetch();
    await mount();
    await openDrawer();
    expect(document.querySelector('[data-workbench-resize]')).not.toBeNull();
    const pin = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Pin')!;
    await act(async () => {
      pin.click();
    });
    expect(window.sessionStorage.getItem('wb-pinned')).toBe('1');
  });
});
