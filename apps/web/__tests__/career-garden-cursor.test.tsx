// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GardenCursor } from '@/components/career-garden/GardenCursor';
import {
  CursorContextBinding,
  GardenWorkspaceProvider,
} from '@/components/career-garden/GardenWorkspaceProvider';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// The provider calls useRouter() for live-mode refreshes; the fixture-mode
// tests only need it to exist.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

/**
 * Interaction contract for the VitalCV Cursor: it owns ⌘K inside the garden
 * (capture-phase preemption of the app-wide palette), renders as a proper
 * dialog, adapts to the registered context, and its only mutation — Capture —
 * is explicit, session-only, and undoable.
 */

let container: HTMLElement | null = null;
let root: Root | null = null;

async function renderCursor(children?: React.ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <GardenWorkspaceProvider>
        {children}
        <GardenCursor mount="holder" />
      </GardenWorkspaceProvider>,
    );
  });
}

afterEach(async () => {
  if (root) {
    await act(async () => {
      root!.unmount();
    });
  }
  container?.remove();
  container = null;
  root = null;
});

function pressCtrlK(target: EventTarget = document.body) {
  const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

function findButton(label: string): HTMLButtonElement {
  const buttons = Array.from(document.querySelectorAll('button'));
  const match = buttons.find((b) => (b.textContent ?? '').trim().startsWith(label));
  if (!match) throw new Error(`button not found: ${label}`);
  return match as HTMLButtonElement;
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('GardenCursor', () => {
  it('opens on Ctrl+K as a modal dialog and preempts bubble-phase listeners', async () => {
    await renderCursor();

    // A stand-in for the app-wide palette: a bubble-phase document listener.
    let globalPaletteSaw = 0;
    const globalListener = () => {
      globalPaletteSaw += 1;
    };
    document.addEventListener('keydown', globalListener);

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => {
      pressCtrlK();
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(globalPaletteSaw).toBe(0);
    document.removeEventListener('keydown', globalListener);

    // The five-action belt, with accessible pressed state.
    for (const label of ['Capture', 'Search', 'Organize', 'Prepare', 'Ask']) {
      expect(findButton(label).getAttribute('aria-pressed')).toMatch(/true|false/);
    }
    // Honesty footer.
    expect(document.body.textContent).toContain('never changes your workspace without your explicit approval');
  });

  it('closes on Escape and re-shows the quiet orb', async () => {
    await renderCursor();
    await act(async () => {
      pressCtrlK();
    });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => {
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(
      document.querySelector('[aria-label="Open the VitalCV Cursor (Cmd or Ctrl + K)"]'),
    ).not.toBeNull();
  });

  it('captures a note explicitly, session-only, with one-click undo', async () => {
    await renderCursor();
    await act(async () => {
      pressCtrlK();
    });
    await act(async () => {
      findButton('Capture').click();
    });

    const textarea = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Capture body"]');
    expect(textarea).not.toBeNull();
    const save = findButton('Save as a private seed');
    expect(save.disabled).toBe(true);

    await act(async () => {
      setNativeValue(textarea!, 'Hallway idea about spaced POCUS practice.');
    });
    expect(findButton('Save as a private seed').disabled).toBe(false);

    await act(async () => {
      findButton('Save as a private seed').click();
    });
    expect(document.body.textContent).toContain('Saved to your notes for this session.');

    await act(async () => {
      findButton('Undo').click();
    });
    expect(document.body.textContent).not.toContain('Saved to your notes for this session.');
  });

  it('adapts its quick actions to a registered note context', async () => {
    await renderCursor(
      <CursorContextBinding
        context={{ type: 'note', id: 'seed-journal-club', label: 'Journal club reflection — discharge follow-up calls' }}
      />,
    );
    await act(async () => {
      pressCtrlK();
    });

    expect(document.body.textContent).toContain('Journal club reflection');
    expect(findButton('Organize this note')).toBeTruthy();

    const growLink = Array.from(document.querySelectorAll('a')).find((a) =>
      (a.textContent ?? '').includes('Create CV bullet'),
    );
    expect(growLink?.getAttribute('href')).toBe('/holder/garden/notes?note=seed-journal-club&grow=1');

    // Organize pane is suggestions-only.
    await act(async () => {
      findButton('Organize this note').click();
    });
    expect(document.body.textContent).toContain('Suggestions only — nothing is applied in this prototype.');
  });

  it('answers Ask deterministically from the fixture and says so', async () => {
    await renderCursor();
    await act(async () => {
      pressCtrlK();
    });
    await act(async () => {
      findButton('Ask').click();
    });
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Ask your workspace"]');
    expect(input).not.toBeNull();
    await act(async () => {
      setNativeValue(input!, 'what needs review among my publications?');
    });
    expect(document.body.textContent).toContain('Two publication candidates');
    expect(document.body.textContent).toContain('no AI service is called in this prototype');
  });
});
