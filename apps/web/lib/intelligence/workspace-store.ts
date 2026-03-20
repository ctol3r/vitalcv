'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  buildInvestigationHref,
  buildInvestigationSearchParams,
  currentInvestigationState,
  mergeInvestigationState,
  normalizeInvestigationState,
  parseInvestigationRouteState,
  type IntelligenceFocus,
  type InvestigationRouteState,
  type OSMode,
  type WorkspacePanel,
  type PinnedEntity,
  useInvestigationContextStore,
} from '@/stores/investigation-context';

export type { OSMode } from '@/stores/investigation-context';

export interface WorkspaceState {
  focus: IntelligenceFocus;
  mode: OSMode;
  npi: string | null;
  findingId: string | null;
  storylineId: string | null;
  evidenceId: string | null;
  actionId: string | null;
  graphFocus: string | null;
  openPanels: WorkspacePanel[];
  pinnedEntities: PinnedEntity[];
  compareNpis: string[];
}

function hasRouteInput(searchParams: URLSearchParams): boolean {
  return [
    'focus',
    'id',
    'provider',
    'npi',
    'findingId',
    'storylineId',
    'actionId',
    'evidenceId',
    'graphFocus',
    'mode',
    'open',
    'pin',
  ].some((key) => searchParams.has(key));
}

function hasMeaningfulState(state: InvestigationRouteState): boolean {
  return (
    state.focus !== 'dashboard'
    || state.mode !== 'monitor'
    || Boolean(state.selectedProvider)
    || Boolean(state.selectedFinding)
    || Boolean(state.selectedStoryline)
    || Boolean(state.selectedAction)
    || Boolean(state.selectedEvidence)
    || state.pinnedEntities.length > 0
    || state.openPanels.some((panel) => panel !== 'graph' && panel !== 'evidence' && panel !== 'copilot')
  );
}

function toWorkspaceState(state: InvestigationRouteState): WorkspaceState {
  return {
    focus: state.focus,
    mode: state.mode,
    npi: state.selectedProvider,
    findingId: state.selectedFinding,
    storylineId: state.selectedStoryline,
    evidenceId: state.selectedEvidence,
    actionId: state.selectedAction,
    graphFocus: state.graphFocus,
    openPanels: state.openPanels,
    pinnedEntities: state.pinnedEntities,
    compareNpis: state.pinnedEntities
      .filter((entity) => entity.type === 'provider')
      .map((entity) => entity.id),
  };
}

export function useWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hydrateFromRoute = useInvestigationContextStore((state) => state.hydrateFromRoute);
  const routeState = useInvestigationContextStore((state) => normalizeInvestigationState(state));

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (hasRouteInput(params)) {
      hydrateFromRoute(parseInvestigationRouteState(params));
    }
  }, [hydrateFromRoute, searchParams]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextState = currentInvestigationState();
    const nextHref = hasMeaningfulState(nextState)
      ? buildInvestigationHref(nextState)
      : '/intelligence';
    const currentHref = `${pathname}${searchParams.size > 0 ? `?${searchParams.toString()}` : ''}`;

    if (nextHref !== currentHref) {
      router.replace(nextHref);
    }
  }, [pathname, router, routeState, searchParams]);

  const applyPartial = useCallback((next: Partial<WorkspaceState>) => {
    const current = currentInvestigationState();
    const merged = mergeInvestigationState(current, {
      focus: next.focus ?? current.focus,
      mode: next.mode ?? current.mode,
      selectedProvider: next.npi ?? current.selectedProvider,
      selectedFinding: next.findingId ?? current.selectedFinding,
      selectedStoryline: next.storylineId ?? current.selectedStoryline,
      selectedEvidence: next.evidenceId ?? current.selectedEvidence,
      selectedAction: next.actionId ?? current.selectedAction,
      graphFocus: next.graphFocus ?? current.graphFocus,
      openPanels: next.openPanels ?? current.openPanels,
      pinnedEntities: next.pinnedEntities ?? (
        next.compareNpis
          ? next.compareNpis.map((id) => ({ type: 'provider' as const, id }))
          : current.pinnedEntities
      ),
    });

    hydrateFromRoute(merged);
  }, [hydrateFromRoute]);

  const state = useMemo(
    () => toWorkspaceState(routeState),
    [routeState],
  );

  const push = useCallback(
    (next: Partial<WorkspaceState>) => {
      applyPartial(next);
    },
    [applyPartial],
  );

  const replace = useCallback(
    (next: Partial<WorkspaceState>) => {
      applyPartial(next);
    },
    [applyPartial],
  );

  return { state, push, replace };
}

export function buildWorkspaceSearchParams(state: WorkspaceState): URLSearchParams {
  return buildInvestigationSearchParams(normalizeInvestigationState({
    focus: state.focus,
    mode: state.mode,
    selectedProvider: state.npi,
    selectedFinding: state.findingId,
    selectedStoryline: state.storylineId,
    selectedEvidence: state.evidenceId,
    selectedAction: state.actionId,
    graphFocus: state.graphFocus,
    openPanels: state.openPanels,
    pinnedEntities: state.pinnedEntities.length > 0
      ? state.pinnedEntities
      : state.compareNpis.map((id) => ({ type: 'provider', id })),
  }));
}
