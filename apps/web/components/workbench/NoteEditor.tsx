'use client';

import * as React from 'react';

import { renderNoteBody } from '@/lib/workbench/markdown';
import { LINK_TARGET_TYPE_LABEL, pickerCandidates, type PickerCandidate } from '@/lib/workbench/linkTargets';
import { WORKBENCH_BRANDING } from '@/lib/career-garden/branding';

/**
 * NoteEditor — CC-08 / WB-04: write, preview, linked context, and history
 * inside the Workbench pane (CC-07 shell).
 *
 * Honesty rules, pinned by tests:
 *  - Autosave states are real: 'Saved' appears only after a 2xx; a failed
 *    save keeps every character, says so, and offers Retry.
 *  - Preview is the safe renderer (react elements only — no HTML pipeline
 *    exists to exploit).
 *  - A grown note keeps its record: the backend refuses edits (409) and the
 *    editor renders read-only rather than pretending.
 *  - Restore never destroys history (the backend captures a pre_restore
 *    revision and audits) — the UI says exactly that.
 */

export interface EditorNote {
  id: string;
  title: string;
  body: string;
  tags: string[];
  status: string;
}

interface Revision {
  id: string;
  cause: string;
  title: string;
  body: string;
  createdAt: string;
}

interface NoteLink {
  id: string;
  targetType: string;
  targetId: string;
  label: string;
  resolved: boolean;
}

interface Backlink {
  id: string;
  fromNoteId: string;
  fromTitle: string;
}

type SaveState =
  | { mode: 'idle' }
  | { mode: 'pending' }
  | { mode: 'saved'; at: string }
  | { mode: 'failed' };

type Tab = 'write' | 'preview' | 'context' | 'history';

const AUTOSAVE_MS = 800;

export function NoteEditor({
  note,
  onSaved,
  onDirtyChange,
  onOpenNote,
}: {
  note: EditorNote;
  onSaved: (note: EditorNote) => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** Open another owned note in a stacked pane (CC-07 shell semantics). */
  onOpenNote?: (noteId: string) => void;
}) {
  const readOnly = note.status === 'grown';
  const [tab, setTab] = React.useState<Tab>('write');
  const [title, setTitle] = React.useState(note.title);
  const [body, setBody] = React.useState(note.body);
  const [saveState, setSaveState] = React.useState<SaveState>({ mode: 'idle' });
  const [revisions, setRevisions] = React.useState<Revision[] | 'loading' | 'unavailable'>('loading');
  const [links, setLinks] = React.useState<NoteLink[] | 'loading' | 'unavailable'>('loading');
  const [backlinks, setBacklinks] = React.useState<Backlink[] | 'loading' | 'unavailable'>('loading');
  const [restoredFrom, setRestoredFrom] = React.useState<string | null>(null);
  // CC-09: the [[ typed-link picker. Anchor = index of the '[[' in body.
  const [picker, setPicker] = React.useState<{ query: string; anchor: number } | null>(null);
  const [pickerError, setPickerError] = React.useState<string | null>(null);
  const [pickerPool, setPickerPool] = React.useState<{
    notes: Array<{ id: string; title: string }>;
    cv: Array<{ id: string; headline: string }>;
  } | null>(null);

  const lastSaved = React.useRef({ title: note.title, body: note.body });
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = title !== lastSaved.current.title || body !== lastSaved.current.body;

  React.useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  // A dirty editor never dies silently on hard unload.
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = React.useCallback(async () => {
    const payload = { title: title.trim() || undefined, body };
    setSaveState({ mode: 'pending' });
    try {
      const res = await fetch(`/api/profile/garden/notes/${encodeURIComponent(note.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { note?: EditorNote };
      lastSaved.current = { title, body };
      setSaveState({ mode: 'saved', at: new Date().toLocaleTimeString() });
      if (json.note) onSaved(json.note);
    } catch {
      // Nothing was recorded as successful; the draft is untouched.
      setSaveState({ mode: 'failed' });
    }
  }, [note.id, title, body, onSaved]);

  // Debounced autosave on content change.
  React.useEffect(() => {
    if (readOnly || !dirty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [title, body, dirty, readOnly, save]);

  const loadHistory = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/profile/garden/notes/${encodeURIComponent(note.id)}/revisions`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { revisions?: Revision[] };
      setRevisions(json.revisions ?? []);
    } catch {
      setRevisions('unavailable');
    }
  }, [note.id]);

  const loadContext = React.useCallback(async () => {
    try {
      const [linksRes, backRes] = await Promise.all([
        fetch(`/api/profile/garden/notes/${encodeURIComponent(note.id)}/links`, { cache: 'no-store' }),
        fetch(`/api/profile/garden/notes/${encodeURIComponent(note.id)}/backlinks`, { cache: 'no-store' }),
      ]);
      if (!linksRes.ok || !backRes.ok) throw new Error('unavailable');
      const linksJson = (await linksRes.json()) as { links?: NoteLink[] };
      const backJson = (await backRes.json()) as { backlinks?: Backlink[] };
      setLinks(linksJson.links ?? []);
      setBacklinks(backJson.backlinks ?? []);
    } catch {
      setLinks('unavailable');
      setBacklinks('unavailable');
    }
  }, [note.id]);

  const restore = async (revisionId: string) => {
    try {
      const res = await fetch(
        `/api/profile/garden/notes/${encodeURIComponent(note.id)}/revisions/${encodeURIComponent(revisionId)}/restore`,
        { method: 'POST' },
      );
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { note?: EditorNote; restoredFrom?: string };
      if (json.note) {
        setTitle(json.note.title);
        setBody(json.note.body);
        lastSaved.current = { title: json.note.title, body: json.note.body };
        setRestoredFrom(json.restoredFrom ?? revisionId);
        onSaved(json.note);
        await loadHistory();
      }
    } catch {
      setRevisions('unavailable');
    }
  };

  const loadPickerPool = React.useCallback(async () => {
    if (pickerPool) return;
    try {
      const [notesRes, cvRes] = await Promise.all([
        fetch('/api/profile/garden/notes', { cache: 'no-store' }),
        fetch('/api/profile/garden/cv', { cache: 'no-store' }),
      ]);
      const notesJson = notesRes.ok ? ((await notesRes.json()) as { notes?: Array<{ id: string; title: string }> }) : {};
      const cvJson = cvRes.ok ? ((await cvRes.json()) as { entries?: Array<{ id: string; headline: string }> }) : {};
      setPickerPool({ notes: notesJson.notes ?? [], cv: cvJson.entries ?? [] });
    } catch {
      setPickerPool({ notes: [], cv: [] });
    }
  }, [pickerPool]);

  /** Detect an unclosed `[[` immediately before the caret. */
  const detectPicker = (value: string, caret: number) => {
    const upToCaret = value.slice(0, caret);
    const open = upToCaret.lastIndexOf('[[');
    if (open === -1 || upToCaret.indexOf(']]', open) !== -1) {
      setPicker(null);
      return;
    }
    setPicker({ query: upToCaret.slice(open + 2), anchor: open });
    setPickerError(null);
    void loadPickerPool();
  };

  const chooseCandidate = async (candidate: PickerCandidate) => {
    try {
      const res = await fetch(`/api/profile/garden/notes/${encodeURIComponent(note.id)}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType: candidate.targetType, targetId: candidate.targetId }),
      });
      if (res.status === 409) {
        // Already linked: still insert the reference text — the relationship exists.
      } else if (!res.ok) {
        throw new Error(String(res.status));
      }
      if (!picker) return;
      const caretEnd = picker.anchor + 2 + picker.query.length;
      setBody((prev) => `${prev.slice(0, picker.anchor)}[[${candidate.label}]]${prev.slice(caretEnd)}`);
      setPicker(null);
      setLinks('loading'); // context tab refetches next open
    } catch {
      // The typed text stays exactly as typed — plain text, no fake link.
      setPickerError('Could not create the link — your text is unchanged.');
    }
  };

  /** Unlink removes only the relationship — never the referenced thing. */
  const unlink = async (linkId: string) => {
    try {
      const res = await fetch(`/api/profile/garden/links/${encodeURIComponent(linkId)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(String(res.status));
      await loadContext();
    } catch {
      setLinks('unavailable');
      setBacklinks('unavailable');
    }
  };

  const openTab = (next: Tab) => {
    setTab(next);
    if (next === 'history') void loadHistory();
    if (next === 'context') void loadContext();
  };

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'write', label: 'Write' },
    { key: 'preview', label: 'Preview' },
    { key: 'context', label: 'Linked context' },
    { key: 'history', label: 'History' },
  ];

  return (
    <div data-note-editor={note.id}>
      <div role="tablist" aria-label="Note views" className="flex gap-1 border-b" style={{ borderColor: 'var(--rule, #ddd)' }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? 'mz-btn mz-btn-sm' : 'mz-btn-ghost mz-btn-sm'}
            onClick={() => openTab(t.key)}
            style={{ minHeight: 44 }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'write' ? (
        <section aria-label="Write">
          {readOnly ? (
            <p className="mz-small mt-3" role="status" data-editor-readonly>
              A grown note keeps its record — this one is read-only. Capture a new seed to keep thinking.
            </p>
          ) : null}
          <label className="mz-small mt-3 block" htmlFor="ed-title">
            Title
          </label>
          <input
            id="ed-title"
            value={title}
            readOnly={readOnly}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full border p-2"
            style={{ borderColor: 'var(--rule, #ddd)' }}
          />
          <label className="mz-small mt-3 block" htmlFor="ed-body">
            Note
          </label>
          <textarea
            id="ed-body"
            value={body}
            readOnly={readOnly}
            onChange={(e) => {
              setBody(e.target.value);
              detectPicker(e.target.value, e.target.selectionStart ?? e.target.value.length);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && picker) {
                e.stopPropagation();
                setPicker(null);
              }
            }}
            rows={10}
            className="mt-1 w-full border p-2"
            style={{ borderColor: 'var(--rule, #ddd)' }}
          />
          {picker ? (
            <div
              data-link-picker
              role="listbox"
              aria-label="Link to"
              className="mt-1 border p-2"
              style={{ borderColor: 'var(--rule, #ddd)' }}
            >
              <p className="mz-small" style={{ margin: 0, color: 'var(--vt-text-muted, #666)' }}>
                Link to — typed, private, and only things you can already see. Escape keeps plain text.
              </p>
              {pickerError ? (
                <p className="mz-small" role="alert" style={{ margin: '4px 0 0' }}>
                  {pickerError}
                </p>
              ) : null}
              <ul className="mt-1 space-y-1">
                {(pickerPool
                  ? pickerCandidates(picker.query, pickerPool.notes, pickerPool.cv, note.id)
                  : []
                ).map((c) => (
                  <li key={`${c.targetType}:${c.targetId}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      className="mz-btn-ghost mz-btn-sm w-full text-left"
                      onClick={() => void chooseCandidate(c)}
                      style={{ minHeight: 44 }}
                    >
                      <span className="mz-mono" style={{ fontSize: '0.8em', marginRight: 6 }}>
                        {LINK_TARGET_TYPE_LABEL[c.targetType] ?? c.targetType}
                      </span>
                      {c.label}
                    </button>
                  </li>
                ))}
              </ul>
              {pickerPool && pickerCandidates(picker.query, pickerPool.notes, pickerPool.cv, note.id).length === 0 ? (
                <p className="mz-small mt-1">No matches — keep typing to leave it as plain text.</p>
              ) : null}
            </div>
          ) : null}
          <p className="mz-small mt-1" style={{ color: 'var(--vt-text-muted, #666)' }}>
            Only you can see this. Keep patient-identifying and clinical record data out — this space is
            for your professional life.
          </p>
          <p className="mz-small mt-2" role="status" data-save-state={saveState.mode} aria-live="polite">
            {saveState.mode === 'pending'
              ? 'Saving…'
              : saveState.mode === 'saved'
                ? `Saved ${saveState.at}`
                : saveState.mode === 'failed'
                  ? 'Not saved — your text is still here.'
                  : dirty
                    ? 'Unsaved changes'
                    : ' '}
            {saveState.mode === 'failed' ? (
              <button
                type="button"
                className="mz-btn-ghost mz-btn-sm"
                onClick={() => void save()}
                style={{ marginLeft: 8, minHeight: 44 }}
              >
                Retry
              </button>
            ) : null}
          </p>
        </section>
      ) : null}

      {tab === 'preview' ? (
        <section aria-label="Preview" className="mt-3">
          {renderNoteBody(body)}
        </section>
      ) : null}

      {tab === 'context' ? (
        <section aria-label="Linked context" className="mt-3">
          <h3 className="mz-small">
            Links from this note{Array.isArray(links) ? ` (${links.length})` : ''}
          </h3>
          {links === 'loading' ? (
            <p className="mz-small mt-1">Loading…</p>
          ) : links === 'unavailable' ? (
            <p className="mz-small mt-1" role="status">
              {WORKBENCH_BRANDING.storageName} is temporarily unavailable — linked context cannot be read
              right now.
            </p>
          ) : links.length === 0 ? (
            <p className="mz-small mt-1">
              No links yet. The typed link picker arrives with the next wave; links you create will show
              here with what they point at.
            </p>
          ) : (
            <ul className="mt-1 space-y-1" data-editor-links>
              {links.map((l) => (
                <li key={l.id} className="mz-small flex flex-wrap items-center gap-2">
                  <span data-ref-card>{l.label}</span>
                  {!l.resolved ? <span> — no longer visible</span> : null}
                  {l.targetType === 'note' && l.resolved && onOpenNote ? (
                    <button
                      type="button"
                      className="mz-btn-ghost mz-btn-sm"
                      onClick={() => onOpenNote(l.targetId)}
                      style={{ minHeight: 44 }}
                    >
                      Open
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="mz-btn-ghost mz-btn-sm"
                    aria-label={`Unlink ${l.label}`}
                    onClick={() => void unlink(l.id)}
                    style={{ minHeight: 44 }}
                  >
                    Unlink
                  </button>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mz-small mt-4">
            Notes that link here{Array.isArray(backlinks) ? ` (${backlinks.length})` : ''}
          </h3>
          {backlinks === 'loading' ? (
            <p className="mz-small mt-1">Loading…</p>
          ) : backlinks === 'unavailable' ? (
            <p className="mz-small mt-1">—</p>
          ) : backlinks.length === 0 ? (
            <p className="mz-small mt-1">Nothing links here yet.</p>
          ) : (
            <ul className="mt-1 space-y-1" data-editor-backlinks>
              {backlinks.map((b) => (
                <li key={b.id} className="mz-small flex items-center gap-2">
                  <span>{b.fromTitle}</span>
                  {onOpenNote ? (
                    <button
                      type="button"
                      className="mz-btn-ghost mz-btn-sm"
                      onClick={() => onOpenNote(b.fromNoteId)}
                      style={{ minHeight: 44 }}
                    >
                      Open
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === 'history' ? (
        <section aria-label="History" className="mt-3">
          {restoredFrom ? (
            <p className="mz-small" role="status" data-editor-restored>
              Restored — the content it replaced is kept in history too.
            </p>
          ) : null}
          {revisions === 'loading' ? (
            <p className="mz-small mt-1">Loading…</p>
          ) : revisions === 'unavailable' ? (
            <p className="mz-small mt-1" role="status">
              {WORKBENCH_BRANDING.storageName} is temporarily unavailable — history cannot be read right
              now.
            </p>
          ) : revisions.length === 0 ? (
            <p className="mz-small mt-1">No earlier versions yet — history begins with your first edit.</p>
          ) : (
            <ul className="mt-1 space-y-2" data-editor-revisions>
              {revisions.map((r) => (
                <li key={r.id} className="mz-small flex items-center justify-between gap-2">
                  <span>
                    {r.createdAt.slice(0, 10)} · {r.cause === 'pre_restore' ? 'before a restore' : 'edit'} ·{' '}
                    {r.title}
                  </span>
                  {!readOnly ? (
                    <button
                      type="button"
                      className="mz-btn-ghost mz-btn-sm"
                      onClick={() => void restore(r.id)}
                      style={{ minHeight: 44 }}
                    >
                      Restore
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
