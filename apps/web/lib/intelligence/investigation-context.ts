'use client';

/**
 * InvestigationContext — single source of truth for all OS object selection.
 *
 * This is a thin semantic layer over spatialWorkspaceStore. All panel state
 * derives from here. NO component manages its own selected-object state.
 *
 * Usage:
 *   const { selectedFinding, onSelectFinding } = useInvestigationContext();
 */

import { useMemo } from 'react';
import { useSpatialWorkspaceStore } from '@/stores/spatialWorkspaceStore';
import { buildWorkspacePageKey, type SpatialEntityType, type WorkspacePage } from './spatial-workspace';

// ── Types ─────────────────────────────────────────────────────────────────────

export type OSMode = 'monitor' | 'investigate' | 'decide';

export interface InvestigationContextValue {
  // Selected objects (derived from store selectedNode + openPages)
  selectedFinding: string | null;    // finding ID
  selectedProvider: string | null;   // NPI
  selectedStoryline: string | null;  // storyline ID
  graphFocus: string | null;         // page key for graph highlight

  // Ordered open pages
  openPages: readonly WorkspacePage[];

  // Current mode
  mode: OSMode;

  // Event bus — any component emits these to update the entire workspace
  onSelectFinding: (id: string, opts?: { npi?: string | null; storylineId?: string | null; label?: string | null }) => void;
  onSelectProvider: (npi: string, opts?: { label?: string | null }) => void;
  onSelectStoryline: (id: string, opts?: { npi?: string | null; label?: string | null }) => void;
  onClearSelection: () => void;
}

// ── Derive mode from open pages ───────────────────────────────────────────────

function deriveModeFromPages(openPages: readonly WorkspacePage[], selectedNode: string | null): OSMode {
  if (!selectedNode || openPages.length === 0) return 'monitor';
  const selected = openPages.find((p) => p.key === selectedNode);
  if (!selected) return 'monitor';
  if (selected.type === 'finding') return 'investigate';
  if (selected.type === 'storyline') return 'investigate';
  if (selected.type === 'provider') return 'investigate';
  return 'monitor';
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useInvestigationContext(): InvestigationContextValue {
  const openPages = useSpatialWorkspaceStore((s) => s.openPages);
  const selectedNode = useSpatialWorkspaceStore((s) => s.selectedNode);
  const graphFocus = useSpatialWorkspaceStore((s) => s.graphFocus);
  const openEntity = useSpatialWorkspaceStore((s) => s.openEntity);
  const closePage = useSpatialWorkspaceStore((s) => s.closePage);

  // Derive selected object IDs from the selected page key
  const selectedFinding = useMemo(() => {
    if (!selectedNode?.startsWith('finding:')) return null;
    return selectedNode.slice('finding:'.length);
  }, [selectedNode]);

  const selectedProvider = useMemo(() => {
    if (!selectedNode?.startsWith('provider:')) return null;
    return selectedNode.slice('provider:'.length);
  }, [selectedNode]);

  const selectedStoryline = useMemo(() => {
    if (!selectedNode?.startsWith('storyline:')) return null;
    return selectedNode.slice('storyline:'.length);
  }, [selectedNode]);

  const mode = useMemo(
    () => deriveModeFromPages(openPages, selectedNode),
    [openPages, selectedNode],
  );

  // ── Event bus ───────────────────────────────────────────────────────────────

  const onSelectFinding = useMemo(() => (
    (id: string, opts: { npi?: string | null; storylineId?: string | null; label?: string | null } = {}) => {
      // Cascade: provider → finding → storyline (all in one interaction)
      const findingKey = buildWorkspacePageKey('finding', id);

      if (opts.npi) {
        openEntity('provider', opts.npi, { label: opts.npi });
      }

      openEntity('finding', id, {
        sourcePageKey: opts.npi ? buildWorkspacePageKey('provider', opts.npi) : null,
        label: opts.label ?? null,
      });

      if (opts.storylineId) {
        openEntity('storyline', opts.storylineId, {
          sourcePageKey: findingKey,
        });
      }
    }
  ), [openEntity]);

  const onSelectProvider = useMemo(() => (
    (npi: string, opts: { label?: string | null } = {}) => {
      openEntity('provider', npi, { label: opts.label ?? null });
    }
  ), [openEntity]);

  const onSelectStoryline = useMemo(() => (
    (id: string, opts: { npi?: string | null; label?: string | null } = {}) => {
      if (opts.npi) {
        openEntity('provider', opts.npi, { label: opts.npi });
      }
      openEntity('storyline', id, {
        sourcePageKey: opts.npi ? buildWorkspacePageKey('provider', opts.npi) : null,
        label: opts.label ?? null,
      });
    }
  ), [openEntity]);

  const onClearSelection = useMemo(() => () => {
    for (const page of [...openPages]) {
      closePage(page.key);
    }
  }, [openPages, closePage]);

  return {
    selectedFinding,
    selectedProvider,
    selectedStoryline,
    graphFocus,
    openPages,
    mode,
    onSelectFinding,
    onSelectProvider,
    onSelectStoryline,
    onClearSelection,
  };
}
