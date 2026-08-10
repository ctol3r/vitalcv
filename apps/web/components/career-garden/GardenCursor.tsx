'use client';

import * as React from 'react';
import Link from 'next/link';

import {
  AI_DRAFT_LINE,
  CURSOR_HONESTY_LINE,
  DEMO_OPPORTUNITIES,
  DEMO_RESEARCH_ITEMS,
  NOTE_PRIVACY_LINE,
  branchName,
  findOpportunity,
  findSeed,
} from '@/lib/career-garden/demoData';
import type { GardenData } from '@/lib/career-garden/gardenViews';
import { GARDEN_HREF_FOR, type GardenHrefFor, type GardenMount } from '@/lib/career-garden/nav';

import { type CursorMode, useGardenWorkspace } from './GardenWorkspaceProvider';

/**
 * The VitalCV Cursor — a compact command center, not a chat window.
 *
 * Triggers: ⌘/Ctrl+K, the quiet corner orb, or capturing a text selection.
 * The garden pages carry a workspace-wide ⌘K palette of their own, so this
 * listener runs in the capture phase and stops propagation — inside the
 * garden, the Cursor owns the keystroke; everywhere else the global palette
 * behaves as before.
 *
 * Honesty contract: every pane is a deterministic view over the sample
 * workspace. Nothing mutates without an explicit button press, everything
 * that mutates is session-only and reversible, and no AI service is called.
 */

const MODE_META: Array<{ mode: CursorMode; label: string; hint: string }> = [
  { mode: 'capture', label: 'Capture', hint: 'Save a note, thought, or selection' },
  { mode: 'search', label: 'Search', hint: 'Find notes, CV lines, research, postings' },
  { mode: 'organize', label: 'Organize', hint: 'Suggest tags, links, and projects' },
  { mode: 'prepare', label: 'Prepare', hint: 'Explain fit; draft from selected facts' },
  { mode: 'ask', label: 'Ask', hint: 'Ask your workspace a grounded question' },
];

interface SearchHit {
  group: string;
  title: string;
  href: string;
}

function searchWorkspace(query: string, hrefFor: GardenHrefFor, data: GardenData): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];
  for (const s of data.notes) {
    if (`${s.title} ${s.body} ${s.tags.join(' ')}`.toLowerCase().includes(q)) {
      hits.push({ group: 'Notes', title: s.title, href: hrefFor('notes', { note: s.id }) });
    }
  }
  for (const e of data.cvEntries) {
    if (`${e.headline} ${e.detail}`.toLowerCase().includes(q)) {
      hits.push({ group: 'Living CV', title: e.headline, href: hrefFor('cv') });
    }
  }
  for (const r of DEMO_RESEARCH_ITEMS) {
    if (`${r.title} ${r.annotation}`.toLowerCase().includes(q)) {
      hits.push({ group: 'Research', title: r.title, href: hrefFor('research') });
    }
  }
  for (const o of DEMO_OPPORTUNITIES) {
    if (`${o.title} ${o.org} ${o.location}`.toLowerCase().includes(q)) {
      hits.push({ group: 'Opportunities', title: o.title, href: hrefFor('opportunities', { op: o.id }) });
    }
  }
  return hits.slice(0, 8);
}

function groundedAnswer(query: string, data: GardenData): string | null {
  const q = query.toLowerCase();
  if (/seed|note|unfiled|captur/.test(q)) {
    if (data.notes.length === 0) {
      return 'You have no seeds yet. Press Capture and plant the first one — a thought is enough.';
    }
    const unfiled = data.notes.filter((s) => s.status === 'unfiled').length;
    return `You have ${data.notes.length} seed${data.notes.length === 1 ? '' : 's'}; ${unfiled} ${unfiled === 1 ? 'is' : 'are'} unfiled. The newest is “${data.notes[0].title}”.`;
  }
  if (/candidate|publication|scholar|author|review/.test(q)) {
    return 'Two publication candidates from your saved Scholar link are waiting for your review. A name match never becomes authorship until you confirm it.';
  }
  if (/opportunit|role|job|posting|nocturnist/.test(q)) {
    return 'Two sample postings sit in your preparation studio. Real roles live under Roles.';
  }
  if (/\bcv\b|living|bloom/.test(q)) {
    if (data.cvEntries.length === 0) {
      return 'Your living CV has no lines yet — grow one from a note when it feels ready.';
    }
    return `Your living CV holds ${data.cvEntries.length} line${data.cvEntries.length === 1 ? '' : 's'}. Every line carries its provenance.`;
  }
  if (/privacy|private|share|\bsee\b/.test(q)) {
    return 'This workspace is private — only you can see notes until you choose to share. Connections and sharing rules are on the Privacy page.';
  }
  return null;
}

export function GardenCursor({ mount }: { mount: GardenMount }) {
  const hrefFor = GARDEN_HREF_FOR[mount];
  const ws = useGardenWorkspace();
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const captureBodyRef = React.useRef<HTMLTextAreaElement>(null);
  const previousFocus = React.useRef<HTMLElement | null>(null);

  const [query, setQuery] = React.useState('');
  const [captureTitle, setCaptureTitle] = React.useState('');
  const [captureBody, setCaptureBody] = React.useState('');
  const [savedCaptureId, setSavedCaptureId] = React.useState<string | null>(null);
  const [savedLiveNoteId, setSavedLiveNoteId] = React.useState<string | null>(null);
  const [selection, setSelection] = React.useState<{ x: number; y: number; text: string } | null>(null);

  const { cursorOpen, cursorMode, context } = ws;

  /* ⌘/Ctrl+K — capture phase so the garden owns the keystroke here. */
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        e.stopPropagation();
        if (cursorOpen) ws.closeCursor();
        else ws.openCursor();
      } else if (e.key === 'Escape' && cursorOpen) {
        e.preventDefault();
        e.stopPropagation();
        ws.closeCursor();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [cursorOpen, ws]);

  /* Text-selection affordance, scoped to the garden root. */
  React.useEffect(() => {
    const onSelectionSettled = () => {
      window.setTimeout(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim() ?? '';
        if (!sel || sel.isCollapsed || text.length < 8 || text.length > 600) {
          setSelection(null);
          return;
        }
        const anchor = sel.anchorNode;
        const el = anchor instanceof Element ? anchor : anchor?.parentElement;
        if (!el?.closest('[data-garden-root]')) {
          setSelection(null);
          return;
        }
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        setSelection({
          x: Math.max(8, Math.min(rect.left, window.innerWidth - 240)),
          y: Math.min(rect.bottom + 8, window.innerHeight - 56),
          text,
        });
      }, 0);
    };
    const clear = () => setSelection(null);
    document.addEventListener('pointerup', onSelectionSettled);
    document.addEventListener('keyup', onSelectionSettled);
    window.addEventListener('scroll', clear, true);
    return () => {
      document.removeEventListener('pointerup', onSelectionSettled);
      document.removeEventListener('keyup', onSelectionSettled);
      window.removeEventListener('scroll', clear, true);
    };
  }, []);

  /* Focus management: remember the invoker, focus the vessel, restore on close. */
  React.useEffect(() => {
    if (cursorOpen) {
      previousFocus.current = document.activeElement as HTMLElement | null;
      window.setTimeout(() => {
        if (cursorMode === 'capture') captureBodyRef.current?.focus();
        else inputRef.current?.focus();
      }, 0);
    } else {
      previousFocus.current?.focus?.();
      setQuery('');
      setSavedCaptureId(null);
      setSavedLiveNoteId(null);
    }
  }, [cursorOpen, cursorMode]);

  /* Seed the capture pane from a selection hand-off. */
  React.useEffect(() => {
    if (cursorOpen && ws.cursorSeedText) {
      setCaptureBody(ws.cursorSeedText);
      setCaptureTitle('');
    }
  }, [cursorOpen, ws.cursorSeedText]);

  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!nodes || nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const contextChip = context
    ? `${context.type === 'cv' ? 'CV line' : context.type === 'note' ? 'Note' : context.type === 'research' ? 'Research' : 'Opportunity'} — ${context.label}`
    : 'Whole workspace';

  const live = ws.data.mode === 'live';

  const saveCapture = async () => {
    const body = captureBody.trim();
    if (!body) return;
    const title = captureTitle.trim() || `${body.slice(0, 48)}${body.length > 48 ? '…' : ''}`;
    if (live) {
      const noteId = await ws.captureLiveNote(title, body);
      if (noteId) {
        setSavedLiveNoteId(noteId);
        setCaptureBody('');
        setCaptureTitle('');
      }
      return;
    }
    ws.addCapture(title, body);
    setSavedCaptureId(`session-capture-${ws.captures.length + 1}`);
    setCaptureBody('');
    setCaptureTitle('');
  };

  const undoCapture = async () => {
    if (live) {
      if (savedLiveNoteId && (await ws.deleteLiveNote(savedLiveNoteId))) {
        setSavedLiveNoteId(null);
      }
      return;
    }
    if (ws.captures.length === 0) return;
    ws.removeCapture(ws.captures[ws.captures.length - 1].id);
    setSavedCaptureId(null);
  };

  const captureSaved = live ? savedLiveNoteId !== null : savedCaptureId !== null;

  const hits = React.useMemo(() => searchWorkspace(query, hrefFor, ws.data), [query, hrefFor, ws.data]);
  const answer = cursorMode === 'ask' && query.trim() ? groundedAnswer(query, ws.data) : null;

  return (
    <>
      {/* The quiet orb — the pointer trigger, and the only trigger on touch. */}
      {!cursorOpen ? (
        <button
          type="button"
          onClick={() => ws.openCursor()}
          aria-label="Open the VitalCV Cursor (Cmd or Ctrl + K)"
          className="mz-glass-interactive fixed bottom-24 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full lg:bottom-[4.5rem]"
        >
          <span className="mz-mono text-[11px]" style={{ color: 'var(--ink-700)' }}>
            ⌘K / Ctrl+K
          </span>
        </button>
      ) : null}

      {/* Selection hand-off affordance. */}
      {selection && !cursorOpen ? (
        <button
          type="button"
          className="mz-btn mz-btn-sm fixed z-40"
          style={{ left: selection.x, top: selection.y }}
          onClick={() => {
            ws.openCursor('capture', selection.text);
            setSelection(null);
          }}
        >
          Capture with the Cursor
        </button>
      ) : null}

      {cursorOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 pt-[10vh]" role="presentation">
          <button
            type="button"
            aria-label="Close the Cursor"
            onClick={() => ws.closeCursor()}
            className="fixed inset-0 cursor-default"
            style={{ background: 'color-mix(in oklab, var(--ink-950) 18%, transparent)' }}
            tabIndex={-1}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="garden-cursor-title"
            onKeyDown={trapTab}
            className="mz-glass-strong mz-settle relative mx-auto w-full max-w-[640px] rounded-[10px] p-4"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--rule)] pb-3">
              <p id="garden-cursor-title" className="mz-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: 'var(--ink-500)' }}>
                VitalCV Cursor
              </p>
              <p className="mz-mono truncate text-[11px]" style={{ color: 'var(--ink-700)' }}>
                {contextChip}
              </p>
              <button type="button" className="mz-btn-ghost mz-btn-sm shrink-0" onClick={() => ws.closeCursor()}>
                Esc
              </button>
            </div>

            {/* The five-action belt. */}
            <div role="group" aria-label="Cursor actions" className="mt-3 flex flex-wrap gap-1.5">
              {MODE_META.map((m) => (
                <button
                  key={m.mode}
                  type="button"
                  className="mz-opt"
                  aria-pressed={cursorMode === m.mode}
                  title={m.hint}
                  onClick={() => ws.setCursorMode(m.mode)}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Contextual quick actions. */}
            {context ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Suggested for this context">
                {context.type === 'note' ? (
                  <>
                    <button type="button" className="mz-btn-ghost mz-btn-sm" onClick={() => ws.setCursorMode('organize')}>
                      Organize this note
                    </button>
                    <Link
                      href={hrefFor('notes', { note: context.id, grow: '1' })}
                      className="mz-btn-ghost mz-btn-sm"
                      onClick={() => ws.closeCursor()}
                    >
                      Create CV bullet — review first
                    </Link>
                  </>
                ) : null}
                {context.type === 'research' ? (
                  <>
                    <button
                      type="button"
                      className="mz-btn-ghost mz-btn-sm"
                      onClick={() => {
                        ws.setCursorMode('capture');
                        setCaptureTitle(`Insight — ${context.label}`);
                      }}
                    >
                      Save an insight
                    </button>
                    <button
                      type="button"
                      className="mz-btn-ghost mz-btn-sm"
                      onClick={() => {
                        ws.setCursorMode('capture');
                        setCaptureTitle(`Teaching point — ${context.label}`);
                      }}
                    >
                      Create a teaching point
                    </button>
                  </>
                ) : null}
                {context.type === 'cv' ? (
                  <>
                    <Link href={hrefFor('cv')} className="mz-btn-ghost mz-btn-sm" onClick={() => ws.closeCursor()}>
                      Show origin
                    </Link>
                    <button type="button" className="mz-btn-ghost mz-btn-sm" onClick={() => ws.setCursorMode('prepare')}>
                      Improve wording (preview)
                    </button>
                  </>
                ) : null}
                {context.type === 'opportunity' ? (
                  <>
                    <button type="button" className="mz-btn-ghost mz-btn-sm" onClick={() => ws.setCursorMode('prepare')}>
                      Explain fit and gaps
                    </button>
                    <Link
                      href={hrefFor('opportunities', { op: context.id, compose: '1' })}
                      className="mz-btn-ghost mz-btn-sm"
                      onClick={() => ws.closeCursor()}
                    >
                      Draft cover letter
                    </Link>
                  </>
                ) : null}
              </div>
            ) : null}

            {/* Pane body. */}
            <div className="mt-3">
              {cursorMode === 'search' || cursorMode === 'ask' ? (
                <>
                  <input
                    ref={inputRef}
                    className="mz-input w-full"
                    placeholder={cursorMode === 'ask' ? 'Ask your workspace — e.g. “what needs review?”' : 'Search your workspace…'}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label={cursorMode === 'ask' ? 'Ask your workspace' : 'Search your workspace'}
                  />
                  {answer ? (
                    <div className="mz-inset mt-3 p-3">
                      <p className="mz-body">{answer}</p>
                      <p className="mz-small mt-2" style={{ color: 'var(--vt-text-muted)' }}>
                        Grounded in your sample workspace only — no AI service is called in this prototype.
                      </p>
                    </div>
                  ) : null}
                  {query.trim() && (cursorMode === 'search' || !answer) ? (
                    hits.length > 0 ? (
                      <ul className="mt-3 space-y-1.5">
                        {hits.map((h) => (
                          <li key={`${h.group}-${h.title}`}>
                            <Link
                              href={h.href}
                              onClick={() => ws.closeCursor()}
                              className="mz-interactive block rounded-[3px] border border-[var(--rule-soft)] px-3 py-2"
                              style={{ background: 'var(--card)' }}
                            >
                              <span className="mz-mono mr-2 text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--ink-500)' }}>
                                {h.group}
                              </span>
                              <span className="mz-body">{h.title}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mz-small mt-3" style={{ color: 'var(--vt-text-muted)' }}>
                        Nothing in your sample workspace matches that yet.
                      </p>
                    )
                  ) : null}
                  {!query.trim() ? (
                    <p className="mz-small mt-3" style={{ color: 'var(--vt-text-muted)' }}>
                      {cursorMode === 'ask'
                        ? 'Answers come only from what is already in this workspace.'
                        : 'Searches notes, CV lines, research, and sample postings.'}
                    </p>
                  ) : null}
                </>
              ) : null}

              {cursorMode === 'capture' ? (
                <div>
                  <input
                    className="mz-input w-full"
                    placeholder="Title (optional)"
                    value={captureTitle}
                    onChange={(e) => setCaptureTitle(e.target.value)}
                    aria-label="Capture title"
                  />
                  <textarea
                    ref={captureBodyRef}
                    className="mz-input mt-2 w-full"
                    rows={4}
                    placeholder="A thought, a link, a hallway conversation…"
                    value={captureBody}
                    onChange={(e) => setCaptureBody(e.target.value)}
                    aria-label="Capture body"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="mz-btn mz-btn-sm"
                      onClick={() => void saveCapture()}
                      disabled={!captureBody.trim() || ws.pending}
                    >
                      {ws.pending ? 'Saving…' : 'Save as a private seed'}
                    </button>
                    <span className="mz-small" style={{ color: 'var(--vt-text-muted)' }}>
                      {NOTE_PRIVACY_LINE}{live ? '' : ' Session-only in this prototype.'}
                    </span>
                  </div>
                  {ws.lastError ? (
                    <p className="mz-small mt-2" role="alert" style={{ color: 'var(--watch)' }}>
                      {ws.lastError}
                    </p>
                  ) : null}
                  {captureSaved ? (
                    <div className="mz-inset mt-3 flex flex-wrap items-center justify-between gap-2 p-3">
                      <p className="mz-body">
                        {live ? 'Saved to your notes.' : 'Saved to your notes for this session.'}{' '}
                        <Link href={hrefFor('notes')} onClick={() => ws.closeCursor()} className="underline underline-offset-4">
                          See it in Notes
                        </Link>
                      </p>
                      <button type="button" className="mz-btn-ghost mz-btn-sm" onClick={() => void undoCapture()} disabled={ws.pending}>
                        Undo
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {cursorMode === 'organize' ? (
                <OrganizePane contextId={context?.id} contextType={context?.type} hrefFor={hrefFor} onNavigate={() => ws.closeCursor()} data={ws.data} />
              ) : null}

              {cursorMode === 'prepare' ? (
                <PreparePane contextId={context?.id} contextType={context?.type} hrefFor={hrefFor} onNavigate={() => ws.closeCursor()} data={ws.data} />
              ) : null}
            </div>

            <p className="mz-small mt-4 border-t border-[var(--rule)] pt-3" style={{ color: 'var(--vt-text-muted)' }}>
              {CURSOR_HONESTY_LINE}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

function OrganizePane({
  contextId,
  contextType,
  hrefFor,
  onNavigate,
  data,
}: {
  contextId?: string;
  contextType?: string;
  hrefFor: GardenHrefFor;
  onNavigate: () => void;
  data: GardenData;
}) {
  if (contextType === 'note') {
    const live = data.notes.find((n) => n.id === contextId);
    const seed = findSeed(contextId) ?? (live
      ? { title: live.title, tags: live.tags, branchIds: [] as string[] }
      : undefined);
    if (seed) {
      return (
        <div className="mz-inset p-3">
          <p className="mz-small mz-mono uppercase tracking-[0.12em]" style={{ color: 'var(--ink-500)' }}>
            Suggestions for “{seed.title}”
          </p>
          <ul className="mt-2 space-y-1.5">
            <li className="mz-body">
              {seed.tags.length > 0 ? `Tags it already carries: ${seed.tags.join(', ')}.` : 'No tags yet — two or three short ones help future you.'}
            </li>
            {seed.branchIds.length > 0 ? (
              <li className="mz-body">
                Linked project{seed.branchIds.length === 1 ? '' : 's'}: {seed.branchIds.map(branchName).join(', ')}.
              </li>
            ) : null}
            <li className="mz-body">No duplicates found among your seeds.</li>
          </ul>
          <p className="mz-small mt-3" style={{ color: 'var(--vt-text-muted)' }}>
            Suggestions only — nothing is applied in this prototype.
          </p>
        </div>
      );
    }
  }
  const unfiled = data.notes.filter((s) => s.status === 'unfiled').length;
  return (
    <div className="mz-inset p-3">
      <p className="mz-body">
        {unfiled} of your {data.notes.length} seeds are unfiled.{' '}
        <Link href={hrefFor('notes')} onClick={onNavigate} className="underline underline-offset-4">
          Open Notes
        </Link>{' '}
        to link them to a project, or open a note first for note-specific suggestions.
      </p>
      <p className="mz-small mt-3" style={{ color: 'var(--vt-text-muted)' }}>
        Suggestions only — nothing is applied in this prototype.
      </p>
    </div>
  );
}

function PreparePane({
  contextId,
  contextType,
  hrefFor,
  onNavigate,
  data,
}: {
  contextId?: string;
  contextType?: string;
  hrefFor: GardenHrefFor;
  onNavigate: () => void;
  data: GardenData;
}) {
  if (contextType === 'opportunity') {
    const opp = findOpportunity(contextId);
    if (opp) {
      const open = [...opp.requiredEvidence, ...opp.optionalEvidence].filter((e) => e.state !== 'self_attested');
      return (
        <div className="mz-inset p-3">
          <p className="mz-small mz-mono uppercase tracking-[0.12em]" style={{ color: 'var(--ink-500)' }}>
            Why this may fit — sample workspace
          </p>
          <ul className="mt-2 space-y-1.5">
            {opp.fitReasons.map((r) => (
              <li key={r} className="mz-body">
                {r}
              </li>
            ))}
          </ul>
          <p className="mz-body mt-3">
            {open.length} evidence item{open.length === 1 ? '' : 's'} still need{open.length === 1 ? 's' : ''} you —
            details sit on the posting view.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={hrefFor('opportunities', { op: opp.id })} onClick={onNavigate} className="mz-btn-ghost mz-btn-sm">
              Open posting view
            </Link>
            <Link
              href={hrefFor('opportunities', { op: opp.id, compose: '1' })}
              onClick={onNavigate}
              className="mz-btn mz-btn-sm"
            >
              Draft cover letter
            </Link>
          </div>
        </div>
      );
    }
  }
  if (contextType === 'cv') {
    const entry = data.cvEntries.find((e) => e.id === contextId);
    if (entry) {
      return (
        <div className="mz-inset p-3">
          <p className="mz-small mz-mono uppercase tracking-[0.12em]" style={{ color: 'var(--ink-500)' }}>
            Wording preview — static example
          </p>
          <p className="mz-body mt-2">“{entry.headline}: {entry.detail}”</p>
          <p className="mz-body mt-2" style={{ color: 'var(--ink-600)' }}>
            In the product, an AI drafter proposes tighter wording here for your review. This prototype shows the
            interaction only — no AI service is called, and your line is unchanged.
          </p>
          <p className="mz-small mt-3" style={{ color: 'var(--vt-text-muted)' }}>
            {AI_DRAFT_LINE}
          </p>
        </div>
      );
    }
  }
  return (
    <div className="mz-inset p-3">
      <p className="mz-body">
        Open a sample posting to see fit, gaps, and the cover-letter drafter — or browse real roles under Roles.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={hrefFor('opportunities')} onClick={onNavigate} className="mz-btn-ghost mz-btn-sm">
          Preparation studio
        </Link>
        <Link href="/holder/opportunities" className="mz-btn-ghost mz-btn-sm">
          Real roles under Roles
        </Link>
      </div>
    </div>
  );
}
