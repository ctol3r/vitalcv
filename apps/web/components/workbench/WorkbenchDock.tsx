'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

import { WORKBENCH_BRANDING } from '@/lib/career-garden/branding';

/**
 * WorkbenchDock — CC-07 / WB-03, the spatial Workbench shell.
 *
 * A route-aware trigger plus a contextual pane system on signed-in clinician
 * surfaces. Mounted ONLY by HolderWorkspaceFrame (the clinician chrome), so
 * it can never appear on public, employer-marketing, or employer-app routes;
 * a source-scan test pins that closure. On /holder/garden/* the full
 * workspace already owns the surface — and the Cursor owns ⌘K there — so the
 * dock does not mount and there are never two competing launchers.
 *
 * Spatial model:
 *  - Desktop (≥1024px): right-hand drawer, 360–520px, resizable by its left
 *    edge, pinnable. The dock lives in the persistent holder layout, so
 *    client-side navigation never unmounts it — an open drawer and its
 *    unsaved capture text survive route changes by construction.
 *  - Mobile: bottom sheet that expands to a full-screen focused mode. Never
 *    three desktop columns squeezed into slivers.
 *  - Stacked pane: opening a note pushes a browser history entry
 *    (?wb=<id>[,<id>]); Back closes the most recent pane first. Escape
 *    closes the topmost pane, then the drawer.
 *
 * Truth + safety:
 *  - Notes come from the existing /api/profile/garden proxies (identity from
 *    the session, never a header). No new persistence, no second note store.
 *  - Storage failure renders an honest read-only state; capture is disabled,
 *    never optimistically "saved".
 *  - An unsaved capture draft warns before discard (in-app confirm) and
 *    before hard unload (beforeunload). Motion is 180ms and collapses to
 *    none under prefers-reduced-motion.
 */

interface WorkbenchNote {
  id: string;
  title: string;
  body: string;
  tags: string[];
  status: string;
  createdAt: string;
}

type LoadState =
  | { mode: 'loading' }
  | { mode: 'live'; notes: WorkbenchNote[] }
  | { mode: 'unavailable' };

const MIN_WIDTH = 360;
const MAX_WIDTH = 520;
const DEFAULT_WIDTH = 400;

const WB_PARAM = 'wb';

function readPaneStack(): string[] {
  if (typeof window === 'undefined') return [];
  const raw = new URLSearchParams(window.location.search).get(WB_PARAM);
  return raw ? raw.split(',').filter(Boolean) : [];
}

function writePaneStack(stack: string[], push: boolean) {
  const url = new URL(window.location.href);
  if (stack.length) url.searchParams.set(WB_PARAM, stack.join(','));
  else url.searchParams.delete(WB_PARAM);
  if (push) window.history.pushState(window.history.state, '', url);
  else window.history.replaceState(window.history.state, '', url);
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isNarrowViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(max-width: 1023px)').matches;
}

export function WorkbenchDock() {
  const pathname = usePathname();

  const [open, setOpen] = React.useState(false);
  const [pinned, setPinned] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false); // mobile full-screen
  const [width, setWidth] = React.useState(DEFAULT_WIDTH);
  const [panes, setPanes] = React.useState<string[]>([]);
  const [draft, setDraft] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [load, setLoad] = React.useState<LoadState>({ mode: 'loading' });

  const drawerRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const dirty = draft.trim().length > 0;
  const reduced = prefersReducedMotion();
  const narrow = isNarrowViewport();

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch('/api/profile/garden/notes', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { notes?: WorkbenchNote[] };
      setLoad({ mode: 'live', notes: json.notes ?? [] });
    } catch {
      setLoad({ mode: 'unavailable' });
    }
  }, []);

  // Restore pin + pane stack once on mount; a pinned drawer reopens itself.
  React.useEffect(() => {
    const savedPin = window.sessionStorage.getItem('wb-pinned') === '1';
    setPinned(savedPin);
    const stack = readPaneStack();
    if (stack.length || savedPin) {
      setPanes(stack);
      setOpen(true);
    }
  }, []);

  React.useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  // Back closes the most recent pane first — the stack follows the URL.
  React.useEffect(() => {
    const onPop = () => setPanes(readPaneStack());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // A dirty draft never dies silently on hard unload.
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const closeDrawer = React.useCallback(() => {
    if (dirty && !window.confirm('Discard your unsaved note draft?')) return;
    setDraft('');
    setOpen(false);
    setExpanded(false);
    if (readPaneStack().length) writePaneStack([], false);
    setPanes([]);
    triggerRef.current?.focus();
  }, [dirty]);

  const closeTopPane = React.useCallback(() => {
    // The pane entry lives in history; going back keeps Back-button and
    // Escape semantics identical.
    window.history.back();
  }, []);

  // Escape: topmost pane first, then the drawer. Focus stays managed.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (panes.length > 0) closeTopPane();
      else closeDrawer();
    };
    const node = drawerRef.current;
    node?.addEventListener('keydown', onKey);
    return () => node?.removeEventListener('keydown', onKey);
  }, [open, panes.length, closeDrawer, closeTopPane]);

  // Focus enters the drawer when it opens.
  React.useEffect(() => {
    if (open) drawerRef.current?.focus();
  }, [open]);

  const openPane = (noteId: string) => {
    const next = [...panes.filter((p) => p !== noteId), noteId];
    setPanes(next);
    writePaneStack(next, true);
  };

  const capture = async () => {
    if (!dirty || saving || load.mode === 'unavailable') return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/profile/garden/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: draft.trim() }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setDraft('');
      await refresh();
    } catch {
      // A failed save NEVER looks like a saved one: draft stays, error shows.
      setSaveError('Could not save — your draft is still here. Try again.');
    } finally {
      setSaving(false);
    }
  };

  // The full workspace owns /holder/garden/* (and the Cursor owns ⌘K there):
  // no dock, no second launcher. All hooks run before this bail-out.
  if (pathname?.startsWith('/holder/garden')) return null;

  const transition = reduced ? 'none' : 'transform 180ms ease, opacity 180ms ease';
  const notes = load.mode === 'live' ? load.notes : [];
  const paneNotes = panes
    .map((id) => notes.find((n) => n.id === id))
    .filter((n): n is WorkbenchNote => Boolean(n));

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-workbench-trigger
        onClick={() => (open ? closeDrawer() : setOpen(true))}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="mz-btn mz-btn-sm"
        style={{ position: 'fixed', right: 16, bottom: narrow ? 88 : 24, zIndex: 40, minWidth: 44, minHeight: 44 }}
      >
        {WORKBENCH_BRANDING.shortName}
      </button>

      {open ? (
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal={narrow && expanded ? true : undefined}
          aria-label={WORKBENCH_BRANDING.productName}
          tabIndex={-1}
          data-workbench-drawer
          data-mode={narrow ? 'sheet' : 'drawer'}
          data-expanded={narrow ? expanded : undefined}
          data-pinned={pinned || undefined}
          data-reduced-motion={reduced || undefined}
          style={
            narrow
              ? {
                  position: 'fixed',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  top: expanded ? 0 : 'auto',
                  maxHeight: expanded ? '100vh' : '55vh',
                  zIndex: 50,
                  background: 'var(--paper, #fff)',
                  borderTop: '1px solid var(--rule, #ddd)',
                  transition,
                  display: 'flex',
                  flexDirection: 'column',
                }
              : {
                  position: 'fixed',
                  top: 0,
                  right: 0,
                  bottom: 0,
                  width,
                  zIndex: 50,
                  background: 'var(--paper, #fff)',
                  borderLeft: '1px solid var(--rule, #ddd)',
                  transition,
                  display: 'flex',
                  flexDirection: 'column',
                }
          }
        >
          {!narrow ? (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize the Workbench"
              data-workbench-resize
              onPointerDown={(down) => {
                const startX = down.clientX;
                const startWidth = width;
                const onMove = (move: PointerEvent) => {
                  const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + (startX - move.clientX)));
                  setWidth(next);
                };
                const onUp = () => {
                  window.removeEventListener('pointermove', onMove);
                  window.removeEventListener('pointerup', onUp);
                };
                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', onUp);
              }}
              style={{ position: 'absolute', left: -4, top: 0, bottom: 0, width: 8, cursor: 'col-resize' }}
            />
          ) : null}

          <header
            className="flex items-center justify-between gap-2 border-b p-3"
            style={{ borderColor: 'var(--rule, #ddd)' }}
          >
            <p className="mz-eyebrow" style={{ margin: 0 }}>
              {WORKBENCH_BRANDING.productName}
            </p>
            <div className="flex items-center gap-1">
              {narrow ? (
                <button
                  type="button"
                  className="mz-btn-ghost mz-btn-sm"
                  onClick={() => setExpanded((e) => !e)}
                  aria-pressed={expanded}
                  style={{ minWidth: 44, minHeight: 44 }}
                >
                  {expanded ? 'Collapse' : 'Expand'}
                </button>
              ) : (
                <button
                  type="button"
                  className="mz-btn-ghost mz-btn-sm"
                  onClick={() =>
                    setPinned((p) => {
                      window.sessionStorage.setItem('wb-pinned', p ? '0' : '1');
                      return !p;
                    })
                  }
                  aria-pressed={pinned}
                  style={{ minWidth: 44, minHeight: 44 }}
                >
                  {pinned ? 'Unpin' : 'Pin'}
                </button>
              )}
              <button
                type="button"
                className="mz-btn-ghost mz-btn-sm"
                onClick={closeDrawer}
                aria-label={`Close ${WORKBENCH_BRANDING.shortName}`}
                style={{ minWidth: 44, minHeight: 44 }}
              >
                Close
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-3">
            {paneNotes.length > 0 ? (
              <section aria-label="Open note" data-workbench-pane={paneNotes[paneNotes.length - 1].id}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="mz-h2" style={{ margin: 0 }}>
                    {paneNotes[paneNotes.length - 1].title}
                  </h2>
                  <button
                    type="button"
                    className="mz-btn-ghost mz-btn-sm"
                    onClick={closeTopPane}
                    style={{ minWidth: 44, minHeight: 44 }}
                  >
                    Back
                  </button>
                </div>
                <p className="mz-small mt-1" style={{ color: 'var(--vt-text-muted, #666)' }}>
                  Only you can see this. Read-only here — editing arrives with the editor wave.
                </p>
                <p className="mz-body mt-3" style={{ whiteSpace: 'pre-wrap' }}>
                  {paneNotes[paneNotes.length - 1].body}
                </p>
                {paneNotes.length > 1 ? (
                  <p className="mz-small mt-4" style={{ color: 'var(--vt-text-muted, #666)' }}>
                    {paneNotes.length} panes open — Back or Escape closes the most recent first.
                  </p>
                ) : null}
              </section>
            ) : (
              <section aria-label="Capture and notes">
                <label className="mz-small" htmlFor="wb-capture">
                  Capture a private note
                </label>
                <textarea
                  id="wb-capture"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={load.mode === 'unavailable'}
                  rows={3}
                  className="mt-1 w-full border p-2"
                  style={{ borderColor: 'var(--rule, #ddd)' }}
                  placeholder="Only you can see this. Keep patient details out."
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="mz-btn mz-btn-sm"
                    onClick={() => void capture()}
                    disabled={!dirty || saving || load.mode === 'unavailable'}
                    style={{ minWidth: 44, minHeight: 44 }}
                  >
                    {saving ? 'Saving…' : 'Save note'}
                  </button>
                  {saveError ? (
                    <p className="mz-small" role="alert" style={{ margin: 0 }}>
                      {saveError}
                    </p>
                  ) : null}
                </div>

                {load.mode === 'loading' ? (
                  <p className="mz-small mt-4">Loading your notes…</p>
                ) : load.mode === 'unavailable' ? (
                  <p className="mz-small mt-4" role="status" data-workbench-unavailable>
                    {WORKBENCH_BRANDING.storageName} is temporarily unavailable — nothing you write here
                    can be saved right now, so capture is off until it returns.
                  </p>
                ) : notes.length === 0 ? (
                  <p className="mz-small mt-4">No notes yet — capture the first one above.</p>
                ) : (
                  <ul className="mt-4 space-y-2" aria-label="Your notes">
                    {notes.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          className="mz-btn-ghost mz-btn-sm w-full text-left"
                          onClick={() => openPane(n.id)}
                          style={{ minHeight: 44 }}
                        >
                          {n.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
