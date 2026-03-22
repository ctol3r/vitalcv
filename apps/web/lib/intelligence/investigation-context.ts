'use client';

/**
 * InvestigationContext — semantic selection layer over the canonical
 * investigation workspace store.
 *
 * This keeps older workspace shells on the same persisted state used by
 * `/intelligence` rather than the deprecated spatial-only store.
 */

import { useMemo } from 'react';
import { useInvestigationContextStore } from '@/stores/investigation-context';
import { createWorkspacePage, type WorkspacePage } from './spatial-workspace';

export type OSMode = 'monitor' | 'investigate' | 'decide';

export interface InvestigationContextValue {
  selectedFinding: string | null;
  selectedProvider: string | null;
  selectedStoryline: string | null;
  graphFocus: string | null;
  openPages: readonly WorkspacePage[];
  mode: OSMode;
  onSelectFinding: (id: string, opts?: { npi?: string | null; storylineId?: string | null; label?: string | null }) => void;
  onSelectProvider: (npi: string, opts?: { label?: string | null }) => void;
  onSelectStoryline: (id: string, opts?: { npi?: string | null; label?: string | null }) => void;
  onClearSelection: () => void;
}

function buildOpenPages(input: {
  selectedProvider: string | null;
  selectedFinding: string | null;
  selectedStoryline: string | null;
}): WorkspacePage[] {
  const pages: WorkspacePage[] = [];

  if (input.selectedProvider) {
    pages.push(createWorkspacePage('provider', input.selectedProvider));
  }

  if (input.selectedFinding) {
    pages.push(createWorkspacePage('finding', input.selectedFinding, {
      sourcePageKey: input.selectedProvider ? `provider:${input.selectedProvider}` : null,
    }));
  }

  if (input.selectedStoryline) {
    pages.push(createWorkspacePage('storyline', input.selectedStoryline, {
      sourcePageKey: input.selectedFinding
        ? `finding:${input.selectedFinding}`
        : input.selectedProvider
          ? `provider:${input.selectedProvider}`
          : null,
    }));
  }

  return pages;
}

export function useInvestigationContext(): InvestigationContextValue {
  const selectedFinding = useInvestigationContextStore((state) => state.selectedFinding);
  const selectedProvider = useInvestigationContextStore((state) => state.selectedProvider);
  const selectedStoryline = useInvestigationContextStore((state) => state.selectedStoryline);
  const graphFocus = useInvestigationContextStore((state) => state.graphFocus);
  const mode = useInvestigationContextStore((state) => state.mode);
  const setFinding = useInvestigationContextStore((state) => state.setFinding);
  const setProvider = useInvestigationContextStore((state) => state.setProvider);
  const setStoryline = useInvestigationContextStore((state) => state.setStoryline);
  const resetFocus = useInvestigationContextStore((state) => state.resetFocus);

  const openPages = useMemo(
    () => buildOpenPages({
      selectedProvider,
      selectedFinding,
      selectedStoryline,
    }),
    [selectedFinding, selectedProvider, selectedStoryline],
  );

  return {
    selectedFinding,
    selectedProvider,
    selectedStoryline,
    graphFocus,
    openPages,
    mode,
    onSelectFinding: (id, opts = {}) => {
      if (opts.npi) {
        setProvider(opts.npi, {
          focus: 'investigations',
          graphFocus: opts.npi,
        });
      }
      setFinding(id, {
        providerId: opts.npi ?? selectedProvider,
        storylineId: opts.storylineId ?? selectedStoryline,
        focus: 'investigations',
        graphFocus: id,
      });
    },
    onSelectProvider: (npi) => {
      setProvider(npi, {
        focus: 'investigations',
        graphFocus: npi,
      });
    },
    onSelectStoryline: (id, opts = {}) => {
      if (opts.npi) {
        setProvider(opts.npi, {
          focus: 'investigations',
          graphFocus: opts.npi,
        });
      }
      setStoryline(id, {
        providerId: opts.npi ?? selectedProvider,
        focus: 'investigations',
        graphFocus: id,
      });
    },
    onClearSelection: () => resetFocus(),
  };
}
