'use client';

import * as React from 'react';

import type { CvEntry } from '@/lib/career-garden/demoData';

/**
 * Session-only workspace state for the Career Garden prototype.
 *
 * Everything here is deliberately reversible and ephemeral: plain React
 * state, no storage, no network. Approving a draft or capturing a note
 * changes this session only and can be undone with one click. Real
 * persistence is a later, separately-reviewed wave.
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

interface GardenWorkspaceValue {
  approvedEntries: CvEntry[];
  approveDraft: (entry: CvEntry) => void;
  removeApproved: (id: string) => void;
  captures: SessionCapture[];
  addCapture: (title: string, body: string) => void;
  removeCapture: (id: string) => void;
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

export function GardenWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [approvedEntries, setApprovedEntries] = React.useState<CvEntry[]>([]);
  const [captures, setCaptures] = React.useState<SessionCapture[]>([]);
  const [cursorOpen, setCursorOpen] = React.useState(false);
  const [cursorMode, setCursorMode] = React.useState<CursorMode>('ask');
  const [cursorSeedText, setCursorSeedText] = React.useState('');
  const [context, setContext] = React.useState<CursorContextInfo | null>(null);
  const captureCounter = React.useRef(0);

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
