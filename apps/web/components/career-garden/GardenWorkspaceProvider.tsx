'use client';

import * as React from 'react';
import { WORKBENCH_BRANDING } from '@/lib/career-garden/branding';
import { useRouter } from 'next/navigation';

import type { CvEntry, CvSection } from '@/lib/career-garden/demoData';
import { fixtureGardenData, type GardenData } from '@/lib/career-garden/gardenViews';

/**
 * Workspace state for the Career Garden.
 *
 * Two mounts share this provider:
 *  - `live` (/holder/garden): notes and CV lines are durable backend rows.
 *    Mutations POST through the /api/profile/garden proxies, then
 *    router.refresh() re-renders the server pages from the source of truth.
 *    Nothing mutates without an explicit button press, and every mutation
 *    has a one-click reverse (delete a capture, remove a grown line).
 *  - `fixture` (/dev/career-garden and tests): the sample dataset with
 *    session-only React state — no storage, no network, exactly the
 *    prototype behavior.
 */

export type CursorMode = 'ask' | 'capture' | 'search' | 'organize' | 'prepare';

export interface CursorContextInfo {
  type: 'note' | 'research' | 'cv' | 'opportunity';
  id: string;
  label: string;
}

export interface SessionCapture {
  id: string;
  title: string;
  body: string;
}

export interface PromoteDraftInput {
  section: CvSection;
  headline: string;
  detail: string;
}

interface GardenWorkspaceValue {
  data: GardenData;
  /** True while a live mutation is in flight. */
  pending: boolean;
  /** Last live mutation failure, cleared on the next attempt. */
  lastError: string | null;

  /** Live path: persist a capture. Resolves to the new note id, or null on failure. */
  captureLiveNote: (title: string, body: string) => Promise<string | null>;
  /** Live path: delete a note (the undo for a capture). */
  deleteLiveNote: (noteId: string) => Promise<boolean>;
  /** Live path: explicit promotion after review. Resolves to the entry id. */
  promoteLiveNote: (noteId: string, draft: PromoteDraftInput) => Promise<string | null>;
  /** Live path: remove a grown line (reopens its seed server-side). */
  removeLiveCvEntry: (entryId: string) => Promise<boolean>;

  /* Fixture-only session state (harness + tests). */
  approvedEntries: CvEntry[];
  approveDraft: (entry: CvEntry) => void;
  removeApproved: (id: string) => void;
  captures: SessionCapture[];
  addCapture: (title: string, body: string) => void;
  removeCapture: (id: string) => void;

  /* Cursor state. */
  cursorOpen: boolean;
  cursorMode: CursorMode;
  cursorSeedText: string;
  context: CursorContextInfo | null;
  openCursor: (mode?: CursorMode, seedText?: string) => void;
  closeCursor: () => void;
  setCursorMode: (mode: CursorMode) => void;
  setContext: (ctx: CursorContextInfo | null) => void;
}

const GardenWorkspaceContext = React.createContext<GardenWorkspaceValue | null>(null);

async function requestJson(
  input: string,
  init: RequestInit,
): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  const res = await fetch(input, init);
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, json };
}

function errorMessage(json: Record<string, unknown>): string {
  const err = json.error;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return 'That did not save — nothing was changed. Try again.';
}

export function GardenWorkspaceProvider({
  initial,
  children,
}: {
  initial?: GardenData;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const data = initial ?? fixtureGardenData();

  const [pending, setPending] = React.useState(false);
  const [lastError, setLastError] = React.useState<string | null>(null);

  const [approvedEntries, setApprovedEntries] = React.useState<CvEntry[]>([]);
  const [captures, setCaptures] = React.useState<SessionCapture[]>([]);
  const [cursorOpen, setCursorOpen] = React.useState(false);
  const [cursorMode, setCursorMode] = React.useState<CursorMode>('ask');
  const [cursorSeedText, setCursorSeedText] = React.useState('');
  const [context, setContext] = React.useState<CursorContextInfo | null>(null);
  const captureCounter = React.useRef(0);

  const live = data.mode === 'live';

  const runLive = React.useCallback(
    async (work: () => Promise<{ ok: boolean; json: Record<string, unknown> }>) => {
      if (!live) return null;
      setPending(true);
      setLastError(null);
      try {
        const { ok, json } = await work();
        if (!ok) {
          setLastError(errorMessage(json));
          return null;
        }
        router.refresh();
        return json;
      } catch {
        setLastError(`${WORKBENCH_BRANDING.storageName} is temporarily unavailable — nothing was changed.`);
        return null;
      } finally {
        setPending(false);
      }
    },
    [live, router],
  );

  const captureLiveNote = React.useCallback(
    async (title: string, body: string) => {
      const json = await runLive(() =>
        requestJson('/api/profile/garden/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, body }),
        }),
      );
      const note = json?.note as { id?: string } | undefined;
      return note?.id ?? null;
    },
    [runLive],
  );

  const deleteLiveNote = React.useCallback(
    async (noteId: string) => {
      const json = await runLive(() =>
        requestJson(`/api/profile/garden/notes/${encodeURIComponent(noteId)}`, { method: 'DELETE' }),
      );
      return json !== null;
    },
    [runLive],
  );

  const promoteLiveNote = React.useCallback(
    async (noteId: string, draft: PromoteDraftInput) => {
      const json = await runLive(() =>
        requestJson(`/api/profile/garden/notes/${encodeURIComponent(noteId)}/promote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft),
        }),
      );
      const entry = json?.entry as { id?: string } | undefined;
      return entry?.id ?? null;
    },
    [runLive],
  );

  const removeLiveCvEntry = React.useCallback(
    async (entryId: string) => {
      const json = await runLive(() =>
        requestJson(`/api/profile/garden/cv/${encodeURIComponent(entryId)}`, { method: 'DELETE' }),
      );
      return json !== null;
    },
    [runLive],
  );

  const approveDraft = React.useCallback((entry: CvEntry) => {
    setApprovedEntries((prev) => (prev.some((e) => e.id === entry.id) ? prev : [...prev, entry]));
  }, []);

  const removeApproved = React.useCallback((id: string) => {
    setApprovedEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const addCapture = React.useCallback((title: string, body: string) => {
    captureCounter.current += 1;
    const id = `session-capture-${captureCounter.current}`;
    setCaptures((prev) => [...prev, { id, title, body }]);
  }, []);

  const removeCapture = React.useCallback((id: string) => {
    setCaptures((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const openCursor = React.useCallback((mode?: CursorMode, seedText?: string) => {
    if (mode) setCursorMode(mode);
    if (seedText !== undefined) setCursorSeedText(seedText);
    setCursorOpen(true);
  }, []);

  const closeCursor = React.useCallback(() => {
    setCursorOpen(false);
    setCursorSeedText('');
  }, []);

  const value = React.useMemo<GardenWorkspaceValue>(
    () => ({
      data,
      pending,
      lastError,
      captureLiveNote,
      deleteLiveNote,
      promoteLiveNote,
      removeLiveCvEntry,
      approvedEntries,
      approveDraft,
      removeApproved,
      captures,
      addCapture,
      removeCapture,
      cursorOpen,
      cursorMode,
      cursorSeedText,
      context,
      openCursor,
      closeCursor,
      setCursorMode,
      setContext,
    }),
    [
      data,
      pending,
      lastError,
      captureLiveNote,
      deleteLiveNote,
      promoteLiveNote,
      removeLiveCvEntry,
      approvedEntries,
      approveDraft,
      removeApproved,
      captures,
      addCapture,
      removeCapture,
      cursorOpen,
      cursorMode,
      cursorSeedText,
      context,
      openCursor,
      closeCursor,
    ],
  );

  return <GardenWorkspaceContext.Provider value={value}>{children}</GardenWorkspaceContext.Provider>;
}

export function useGardenWorkspace(): GardenWorkspaceValue {
  const ctx = React.useContext(GardenWorkspaceContext);
  if (!ctx) {
    throw new Error('useGardenWorkspace must be used inside GardenWorkspaceProvider');
  }
  return ctx;
}

/** Registers the page's Cursor context while mounted. */
export function CursorContextBinding({ context }: { context: CursorContextInfo }) {
  const { setContext } = useGardenWorkspace();
  React.useEffect(() => {
    setContext(context);
    return () => setContext(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.type, context.id, context.label]);
  return null;
}
