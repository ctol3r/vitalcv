// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderNoteBody } from '@/lib/workbench/markdown';
import { NoteEditor, type EditorNote } from '@/components/workbench/NoteEditor';

/**
 * CC-08 / WB-04 — editor, autosave, preview, history.
 *
 * The three exit gates, as tests:
 *  1. the XSS corpus cannot execute through note preview (the renderer emits
 *     React elements only — no element, attribute, or URL from note text);
 *  2. a failed network/storage state never appears as a successful save;
 *  3. revision restore flows through the audited backend route and the UI
 *     reports the restore without destroying history.
 */

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const NOTE: EditorNote = {
  id: 'n1',
  title: 'Journal club reflection',
  body: 'First thought',
  tags: [],
  status: 'unfiled',
};

let container: HTMLElement | null = null;
let root: Root | null = null;

async function mountEditor(note: EditorNote = NOTE, onDirtyChange?: (d: boolean) => void) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const onSaved = vi.fn();
  await act(async () => {
    root!.render(<NoteEditor note={note} onSaved={onSaved} onDirtyChange={onDirtyChange} />);
  });
  return { onSaved };
}

async function typeInto(el: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  await act(async () => {
    setter.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function clickTab(label: string) {
  const tab = Array.from(document.querySelectorAll('[role="tab"]')).find((t) => t.textContent === label) as HTMLButtonElement;
  await act(async () => {
    tab.click();
  });
}

beforeEach(() => {
  vi.useRealTimers();
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

describe('XSS corpus cannot execute through preview', () => {
  const CORPUS = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<iframe src="https://evil.example"></iframe>',
    '<svg onload=alert(1)>',
    '"><script>alert(document.cookie)</script>',
    '<a href="javascript:alert(1)">click</a>',
    '<object data="x"></object><embed src="x">',
    '[[<img src=x onerror=alert(1)>]]',
    '- <script>bullet</script>',
    '**<style>@import url(x)</style>**',
    'javascript:alert(1)',
    '<div onclick=alert(1) style="position:fixed">overlay</div>',
  ];

  it('renders every payload as inert text — no elements, no handlers, no links', () => {
    for (const payload of CORPUS) {
      const host = document.createElement('div');
      host.innerHTML = renderToStaticMarkup(<>{renderNoteBody(payload)}</>);
      expect(
        host.querySelectorAll('script, iframe, img, svg, object, embed, style, a, [onclick], [onerror], [onload]').length,
        `payload leaked structure: ${payload}`,
      ).toBe(0);
      // The clinician's literal text survives (angle brackets intact).
      if (payload.includes('<script>')) {
        expect(host.textContent).toContain('<script>');
      }
    }
  });

  it('supported formatting still works and typed references render as inert cards', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(
      <>{renderNoteBody('A **bold** move with `code`.\n\n- item one\n- item two\n\nSee [[Role: Cardiology — San Jose]].')}</>,
    );
    expect(host.querySelector('strong')?.textContent).toBe('bold');
    expect(host.querySelector('code')?.textContent).toBe('code');
    expect(host.querySelectorAll('li').length).toBe(2);
    const card = host.querySelector('[data-ref-card]');
    expect(card?.textContent).toBe('Role: Cardiology — San Jose');
    expect(card?.closest('a')).toBeNull();
  });
});

describe('autosave honesty', () => {
  it('debounces, shows Saving…, and shows Saved only after a 2xx', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ note: { ...NOTE, body: 'Edited' } }),
    })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    await mountEditor();
    const bodyField = document.getElementById('ed-body') as HTMLTextAreaElement;
    await typeInto(bodyField, 'Edited');
    expect(document.querySelector('[data-save-state]')?.getAttribute('data-save-state')).toBe('idle');
    expect((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);

    await act(async () => {
      vi.advanceTimersByTime(900);
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    const state = document.querySelector('[data-save-state]')!;
    expect(state.getAttribute('data-save-state')).toBe('saved');
    expect(state.textContent).toContain('Saved');
    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/profile/garden/notes/n1');
    expect(init.method).toBe('PATCH');
  });

  it('a failed save keeps the text, says so, and Retry can succeed', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ note: { ...NOTE, body: 'Second try' } }) });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await mountEditor();
    const bodyField = document.getElementById('ed-body') as HTMLTextAreaElement;
    await typeInto(bodyField, 'Second try');
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const state = document.querySelector('[data-save-state]')!;
    expect(state.getAttribute('data-save-state')).toBe('failed');
    expect(state.textContent).toContain('Not saved — your text is still here.');
    expect((document.getElementById('ed-body') as HTMLTextAreaElement).value).toBe('Second try');

    const retry = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Retry')!;
    await act(async () => {
      retry.click();
      await vi.runAllTimersAsync();
    });
    expect(document.querySelector('[data-save-state]')?.getAttribute('data-save-state')).toBe('saved');
  });

  it('reports dirtiness upward for the shell close guard', async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    const onDirty = vi.fn();
    await mountEditor(NOTE, onDirty);
    await typeInto(document.getElementById('ed-body') as HTMLTextAreaElement, 'changed');
    expect(onDirty).toHaveBeenLastCalledWith(true);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(onDirty).toHaveBeenLastCalledWith(false);
  });
});

describe('grown notes and the PHI line', () => {
  it('a grown note renders read-only and offers no Restore', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ revisions: [{ id: 'r1', cause: 'update', title: 'T', body: 'B', createdAt: '2026-08-01T00:00:00Z' }] }),
    })) as unknown as typeof fetch;
    await mountEditor({ ...NOTE, status: 'grown' });
    expect(document.querySelector('[data-editor-readonly]')?.textContent).toContain('keeps its record');
    expect((document.getElementById('ed-body') as HTMLTextAreaElement).readOnly).toBe(true);
    await clickTab('History');
    expect(document.querySelector('[data-editor-revisions]')).not.toBeNull();
    expect(Array.from(document.querySelectorAll('button')).some((b) => b.textContent === 'Restore')).toBe(false);
  });

  it('the patient-information prohibition sits beside the writing surface', async () => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    await mountEditor();
    expect(container!.textContent).toContain('Keep patient-identifying and clinical record data out');
  });
});

describe('history and restore', () => {
  it('lists revisions and restores through the audited route, reporting that history is kept', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith('/restore') && init?.method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ note: { ...NOTE, title: 'Older title', body: 'Older body' }, restoredFrom: 'r1' }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          revisions: [
            { id: 'r1', cause: 'update', title: 'Older title', body: 'Older body', createdAt: '2026-08-01T00:00:00Z' },
            { id: 'r2', cause: 'pre_restore', title: 'Mid title', body: 'Mid body', createdAt: '2026-08-02T00:00:00Z' },
          ],
        }),
      };
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { onSaved } = await mountEditor();
    await clickTab('History');
    const items = document.querySelectorAll('[data-editor-revisions] li');
    expect(items.length).toBe(2);
    expect(items[1].textContent).toContain('before a restore');

    const restoreButton = items[0].querySelector('button')!;
    await act(async () => {
      restoreButton.click();
    });
    expect(document.querySelector('[data-editor-restored]')?.textContent).toContain('kept in history too');
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ title: 'Older title' }));
    const restoreCall = fetchMock.mock.calls.find(([u, i]) => String(u).endsWith('/restore') && (i as RequestInit)?.method === 'POST');
    expect(restoreCall?.[0]).toBe('/api/profile/garden/notes/n1/revisions/r1/restore');
    // The editor now shows the restored content in Write.
    await clickTab('Write');
    expect((document.getElementById('ed-body') as HTMLTextAreaElement).value).toBe('Older body');
  });

  it('history unavailability is stated, never blank', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch;
    await mountEditor();
    await clickTab('History');
    expect(container!.textContent).toContain('Workbench storage is temporarily unavailable');
  });
});

describe('linked context', () => {
  it('shows outgoing links with labels, marks unresolved ones, and lists backlinks', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (String(url).endsWith('/links')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            links: [
              { id: 'l1', targetType: 'source_pointer', targetId: 'nppes', label: 'Source: NPPES record (research pointer)', resolved: true },
              { id: 'l2', targetType: 'opportunity', targetId: 'o1', label: 'Role: Nocturnist — IL', resolved: false },
            ],
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ backlinks: [{ id: 'b1', fromNoteId: 'n2', fromTitle: 'Second note' }] }) };
    }) as unknown as typeof fetch;

    await mountEditor();
    await clickTab('Linked context');
    const links = document.querySelectorAll('[data-editor-links] li');
    expect(links.length).toBe(2);
    expect(links[0].textContent).toContain('Source: NPPES record (research pointer)');
    expect(links[1].textContent).toContain('no longer visible');
    expect(document.querySelector('[data-editor-backlinks]')?.textContent).toContain('Second note');
  });
});
