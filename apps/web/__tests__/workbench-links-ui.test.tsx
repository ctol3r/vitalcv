// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NoteEditor, type EditorNote } from '@/components/workbench/NoteEditor';
import { CaptureInWorkbench } from '@/components/workbench/CaptureInWorkbench';
import { pickerCandidates } from '@/lib/workbench/linkTargets';

/**
 * CC-09 / WB-05 — bi-directional links UI.
 *
 * Exit gates as tests:
 *  - backlinks/links render only what the owner-scoped API returned; nothing
 *    is hydrated client-side, so an inaccessible title cannot appear;
 *  - deleting a link calls exactly the unlink endpoint — the referenced
 *    profile/opportunity/note data is untouched by construction (no other
 *    request leaves the client);
 *  - the [[ picker creates typed links (server-validated ids), inserts the
 *    label as text only on success, and a failed create leaves the typed
 *    text exactly as typed.
 */

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const NOTE: EditorNote = { id: 'n1', title: 'Host note', body: '', tags: [], status: 'unfiled' };

let container: HTMLElement | null = null;
let root: Root | null = null;

async function mountEditor(onOpenNote?: (id: string) => void) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<NoteEditor note={NOTE} onSaved={() => {}} onOpenNote={onOpenNote} />);
  });
}

async function typeBody(text: string) {
  const el = document.getElementById('ed-body') as HTMLTextAreaElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(el, text);
    el.setSelectionRange(text.length, text.length);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
  vi.restoreAllMocks();
});

describe('picker candidates are permission-shaped', () => {
  it('offers own notes (excluding the host), own CV lines, and the closed registries — nothing else', () => {
    const out = pickerCandidates('', [{ id: 'n1', title: 'Self' }, { id: 'n2', title: 'Other note' }], [{ id: 'c1', headline: 'A CV line' }], 'n1');
    const types = new Set(out.map((c) => c.targetType));
    expect(types).toEqual(new Set(['note', 'cv_entry', 'profile_field', 'source_pointer']));
    expect(out.some((c) => c.targetId === 'n1')).toBe(false); // no self-link offer
    expect(out.some((c) => c.targetType === 'opportunity')).toBe(false); // deferred, needs search endpoint
  });

  it('filters by query across labels', () => {
    const out = pickerCandidates('nppes', [], []);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ targetType: 'source_pointer', targetId: 'nppes' });
  });
});

describe('the [[ picker in the editor', () => {
  it('opens on an unclosed [[, creates a typed link, and inserts the label only after a 201', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url) === '/api/profile/garden/notes/n1/links' && init?.method === 'POST') {
        return { ok: true, status: 201, json: async () => ({ link: { id: 'l1' } }) };
      }
      if (String(url) === '/api/profile/garden/notes') {
        return { ok: true, status: 200, json: async () => ({ notes: [{ id: 'n2', title: 'Rural telehealth ideas' }] }) };
      }
      if (String(url) === '/api/profile/garden/cv') {
        return { ok: true, status: 200, json: async () => ({ entries: [] }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await mountEditor();
    await typeBody('Thinking about [[rural');
    const picker = document.querySelector('[data-link-picker]');
    expect(picker).not.toBeNull();
    const option = Array.from(picker!.querySelectorAll('[role="option"]')).find((o) =>
      o.textContent?.includes('Rural telehealth ideas'),
    ) as HTMLButtonElement;
    expect(option.textContent).toContain('Note'); // user-visible target type
    await act(async () => {
      option.click();
    });
    // Typed id went to the server; the label went into the text.
    const postCall = fetchMock.mock.calls.find(([, i]) => (i as RequestInit)?.method === 'POST')!;
    expect(JSON.parse(String((postCall[1] as RequestInit).body))).toEqual({ targetType: 'note', targetId: 'n2' });
    expect((document.getElementById('ed-body') as HTMLTextAreaElement).value).toBe(
      'Thinking about [[Rural telehealth ideas]]',
    );
    expect(document.querySelector('[data-link-picker]')).toBeNull();
  });

  it('a failed create leaves the typed text exactly as typed and says so', async () => {
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return { ok: false, status: 503, json: async () => ({}) };
      if (String(url) === '/api/profile/garden/notes') {
        return { ok: true, status: 200, json: async () => ({ notes: [{ id: 'n2', title: 'Rural telehealth ideas' }] }) };
      }
      return { ok: true, status: 200, json: async () => ({ entries: [] }) };
    }) as unknown as typeof fetch;

    await mountEditor();
    await typeBody('Thinking about [[rural');
    const option = Array.from(document.querySelectorAll('[role="option"]'))[0] as HTMLButtonElement;
    await act(async () => {
      option.click();
    });
    expect((document.getElementById('ed-body') as HTMLTextAreaElement).value).toBe('Thinking about [[rural');
    expect(document.querySelector('[data-link-picker] [role="alert"]')?.textContent).toContain(
      'your text is unchanged',
    );
  });

  it('Escape closes the picker and keeps plain text', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ notes: [], entries: [] }) })) as unknown as typeof fetch;
    await mountEditor();
    await typeBody('See [[card');
    expect(document.querySelector('[data-link-picker]')).not.toBeNull();
    const el = document.getElementById('ed-body') as HTMLTextAreaElement;
    await act(async () => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(document.querySelector('[data-link-picker]')).toBeNull();
    expect(el.value).toBe('See [[card');
  });
});

describe('linked context: counts, open, unlink', () => {
  const LINKS = {
    links: [
      { id: 'l1', targetType: 'note', targetId: 'n2', label: 'Rural telehealth ideas', resolved: true },
      { id: 'l2', targetType: 'source_pointer', targetId: 'nppes', label: 'Source: NPPES record (research pointer)', resolved: true },
    ],
  };
  const BACKLINKS = { backlinks: [{ id: 'b1', fromNoteId: 'n3', fromTitle: 'Interview themes' }] };

  function contextFetch() {
    const calls: string[] = [];
    const fn = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${(init?.method ?? 'GET')} ${url}`);
      if (String(url).endsWith('/links') && (!init || !init.method)) return { ok: true, status: 200, json: async () => LINKS };
      if (String(url).endsWith('/backlinks')) return { ok: true, status: 200, json: async () => BACKLINKS };
      if (init?.method === 'DELETE') return { ok: true, status: 200, json: async () => ({ deleted: true }) };
      return { ok: true, status: 200, json: async () => ({}) };
    });
    globalThis.fetch = fn as unknown as typeof fetch;
    return { fn, calls };
  }

  async function openContextTab() {
    const tab = Array.from(document.querySelectorAll('[role="tab"]')).find((t) => t.textContent === 'Linked context') as HTMLButtonElement;
    await act(async () => {
      tab.click();
    });
  }

  it('renders counts and only API-returned rows; Open uses the stacked-pane callback', async () => {
    contextFetch();
    const onOpenNote = vi.fn();
    await mountEditor(onOpenNote);
    await openContextTab();
    expect(container!.textContent).toContain('Links from this note (2)');
    expect(container!.textContent).toContain('Notes that link here (1)');
    const open = Array.from(document.querySelectorAll('[data-editor-links] button')).find((b) => b.textContent === 'Open') as HTMLButtonElement;
    await act(async () => {
      open.click();
    });
    expect(onOpenNote).toHaveBeenCalledWith('n2');
    const backOpen = document.querySelector('[data-editor-backlinks] button') as HTMLButtonElement;
    await act(async () => {
      backOpen.click();
    });
    expect(onOpenNote).toHaveBeenCalledWith('n3');
  });

  it('Unlink calls exactly DELETE /links/:id and nothing touches the referenced target', async () => {
    const { calls } = contextFetch();
    await mountEditor();
    await openContextTab();
    const unlink = Array.from(document.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Unlink Rural telehealth ideas',
    ) as HTMLButtonElement;
    await act(async () => {
      unlink.click();
    });
    const deletes = calls.filter((c) => c.startsWith('DELETE'));
    expect(deletes).toEqual(['DELETE /api/profile/garden/links/l1']);
    // No PATCH/POST/DELETE ever targeted a note, cv, opportunity, or profile
    // resource — the relationship is the only thing that changed.
    expect(
      calls.filter((c) => !c.startsWith('GET')).filter((c) => !c.includes('/garden/links/')),
    ).toEqual([]);
  });
});

describe('contextual capture action', () => {
  it('dispatches the dock capture event with its context label', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(<CaptureInWorkbench context="Role: Nocturnist — IL" />);
    });
    const events: Array<{ context?: string }> = [];
    const listener = (e: Event) => events.push((e as CustomEvent<{ context?: string }>).detail);
    window.addEventListener('vitalcv:workbench-capture', listener);
    const button = document.querySelector('[data-capture-in-workbench]') as HTMLButtonElement;
    expect(button.textContent).toBe('Capture in Workbench');
    await act(async () => {
      button.click();
    });
    window.removeEventListener('vitalcv:workbench-capture', listener);
    expect(events).toEqual([{ context: 'Role: Nocturnist — IL' }]);
  });
});
