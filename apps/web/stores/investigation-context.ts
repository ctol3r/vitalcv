'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type OSMode = 'monitor' | 'investigate' | 'decide';

export const WORKSPACE_PANELS = [
  'provider',
  'finding',
  'storyline',
  'evidence',
  'action',
  'graph',
  'copilot',
] as const;

export const INTELLIGENCE_FOCUS = [
  'dashboard',
  'findings',
  'providers',
  'storylines',
  'actions',
  'investigations',
  'graph',
  'system-health',
  'calibration',
  'finding',
  'provider',
  'storyline',
  'action',
] as const;

export type WorkspacePanel = (typeof WORKSPACE_PANELS)[number];
export type IntelligenceFocus = (typeof INTELLIGENCE_FOCUS)[number];
export type PinnedEntityType = 'provider' | 'finding' | 'storyline' | 'action';
export type EvidenceSort = 'newest' | 'strongest';
export type EvidenceGroup = 'none' | 'source';
export type EvidenceDensity = 'compact' | 'expanded';

export interface PinnedEntity {
  type: PinnedEntityType;
  id: string;
}

export interface InvestigationRouteState {
  focus: IntelligenceFocus;
  mode: OSMode;
  selectedProvider: string | null;
  selectedFinding: string | null;
  selectedStoryline: string | null;
  selectedEvidence: string | null;
  selectedAction: string | null;
  graphFocus: string | null;
  openPanels: WorkspacePanel[];
  pinnedEntities: PinnedEntity[];
  queueCursor: string | null;
  evidenceSort: EvidenceSort;
  evidenceGroup: EvidenceGroup;
  evidenceDensity: EvidenceDensity;
}

export interface InvestigationContextState extends InvestigationRouteState {
  hydrated: boolean;
  hydrateFromRoute: (state: InvestigationRouteState) => void;
  setFocus: (focus: IntelligenceFocus) => void;
  setFinding: (findingId: string | null, options?: SelectionOptions) => void;
  setProvider: (providerId: string | null, options?: SelectionOptions) => void;
  setStoryline: (storylineId: string | null, options?: SelectionOptions) => void;
  setEvidence: (evidenceId: string | null) => void;
  setAction: (actionId: string | null, options?: SelectionOptions) => void;
  setMode: (mode: OSMode) => void;
  setGraphFocus: (graphFocus: string | null) => void;
  pinEntity: (entity: PinnedEntity) => void;
  unpinEntity: (entity: PinnedEntity) => void;
  openPanel: (panel: WorkspacePanel) => void;
  closePanel: (panel: WorkspacePanel) => void;
  setQueueCursor: (cursor: string | null) => void;
  setEvidenceSort: (sort: EvidenceSort) => void;
  setEvidenceGroup: (group: EvidenceGroup) => void;
  setEvidenceDensity: (density: EvidenceDensity) => void;
  resetFocus: () => void;
}

export interface SelectionOptions {
  providerId?: string | null;
  findingId?: string | null;
  storylineId?: string | null;
  actionId?: string | null;
  evidenceId?: string | null;
  focus?: IntelligenceFocus;
  mode?: OSMode;
  graphFocus?: string | null;
  openPanels?: WorkspacePanel[];
}

const STORAGE_KEY = 'vitalcv_investigation_context_v1';
const DEFAULT_OPEN_PANELS: WorkspacePanel[] = ['graph', 'evidence', 'copilot'];
const DEFAULT_STATE: InvestigationRouteState = {
  focus: 'dashboard',
  mode: 'monitor',
  selectedProvider: null,
  selectedFinding: null,
  selectedStoryline: null,
  selectedEvidence: null,
  selectedAction: null,
  graphFocus: null,
  openPanels: DEFAULT_OPEN_PANELS,
  pinnedEntities: [],
  queueCursor: null,
  evidenceSort: 'newest',
  evidenceGroup: 'none',
  evidenceDensity: 'expanded',
};

function isWorkspacePanel(value: string | null | undefined): value is WorkspacePanel {
  return Boolean(value) && WORKSPACE_PANELS.includes(value as WorkspacePanel);
}

function isFocus(value: string | null | undefined): value is IntelligenceFocus {
  return Boolean(value) && INTELLIGENCE_FOCUS.includes(value as IntelligenceFocus);
}

function isMode(value: string | null | undefined): value is OSMode {
  return value === 'monitor' || value === 'investigate' || value === 'decide';
}

function isPinnedEntityType(value: string | null | undefined): value is PinnedEntityType {
  return value === 'provider' || value === 'finding' || value === 'storyline' || value === 'action';
}

function isEvidenceSort(value: string | null | undefined): value is EvidenceSort {
  return value === 'newest' || value === 'strongest';
}

function isEvidenceGroup(value: string | null | undefined): value is EvidenceGroup {
  return value === 'none' || value === 'source';
}

function isEvidenceDensity(value: string | null | undefined): value is EvidenceDensity {
  return value === 'compact' || value === 'expanded';
}

function uniquePanels(values: readonly WorkspacePanel[]): WorkspacePanel[] {
  return [...new Set(values)];
}

function uniquePinned(values: readonly PinnedEntity[]): PinnedEntity[] {
  const seen = new Set<string>();
  const items: PinnedEntity[] = [];

  for (const value of values) {
    const key = `${value.type}:${value.id}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push(value);
  }

  return items;
}

function mergeOpenPanels(
  panels: readonly WorkspacePanel[] | undefined,
  requiredPanels: readonly WorkspacePanel[],
): WorkspacePanel[] {
  return uniquePanels([
    ...(panels ?? []),
    ...requiredPanels,
  ]);
}

function parsePinnedEntity(value: string): PinnedEntity | null {
  const separator = value.indexOf(':');
  if (separator <= 0 || separator >= value.length - 1) {
    return null;
  }

  const type = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (!isPinnedEntityType(type) || id.trim().length === 0) {
    return null;
  }

  return { type, id };
}

function inferFocusFromSelections(input: Partial<InvestigationRouteState>): IntelligenceFocus {
  if (isFocus(input.focus)) {
    return input.focus;
  }

  if (input.selectedAction) {
    return 'action';
  }
  if (input.selectedFinding) {
    return 'finding';
  }
  if (input.selectedStoryline) {
    return 'storyline';
  }
  if (input.selectedProvider) {
    return 'provider';
  }

  return 'dashboard';
}

function inferModeFromSelections(input: Partial<InvestigationRouteState>): OSMode {
  if (isMode(input.mode)) {
    return input.mode;
  }

  const focus = inferFocusFromSelections(input);
  if (focus === 'actions' || focus === 'action') {
    return 'decide';
  }
  if (focus === 'finding' || focus === 'provider' || focus === 'storyline' || focus === 'investigations' || focus === 'graph') {
    return 'investigate';
  }

  return 'monitor';
}

export function normalizeInvestigationState(input: Partial<InvestigationRouteState>): InvestigationRouteState {
  const selectedProvider = input.selectedProvider ?? null;
  const selectedFinding = input.selectedFinding ?? null;
  const selectedStoryline = input.selectedStoryline ?? null;
  const selectedAction = input.selectedAction ?? null;
  const focus = inferFocusFromSelections({
    ...DEFAULT_STATE,
    ...input,
    selectedProvider,
    selectedFinding,
    selectedStoryline,
    selectedAction,
  });
  const mode = inferModeFromSelections({
    ...DEFAULT_STATE,
    ...input,
    focus,
  });

  return {
    focus,
    mode,
    selectedProvider,
    selectedFinding,
    selectedStoryline,
    selectedEvidence: input.selectedEvidence ?? null,
    selectedAction,
    graphFocus: input.graphFocus ?? selectedFinding ?? selectedStoryline ?? selectedProvider ?? selectedAction ?? null,
    openPanels: uniquePanels(input.openPanels && input.openPanels.length > 0 ? input.openPanels : DEFAULT_OPEN_PANELS),
    pinnedEntities: uniquePinned(input.pinnedEntities ?? []),
    queueCursor: input.queueCursor ?? selectedFinding ?? selectedStoryline ?? selectedProvider ?? selectedAction ?? null,
    evidenceSort: isEvidenceSort(input.evidenceSort) ? input.evidenceSort : DEFAULT_STATE.evidenceSort,
    evidenceGroup: isEvidenceGroup(input.evidenceGroup) ? input.evidenceGroup : DEFAULT_STATE.evidenceGroup,
    evidenceDensity: isEvidenceDensity(input.evidenceDensity) ? input.evidenceDensity : DEFAULT_STATE.evidenceDensity,
  };
}

export function mergeInvestigationState(
  state: InvestigationRouteState,
  updates: Partial<InvestigationRouteState>,
): InvestigationRouteState {
  return normalizeInvestigationState({
    ...state,
    ...updates,
  });
}

function canonicalSelectionFromRoute(searchParams: URLSearchParams): Partial<InvestigationRouteState> {
  const focusParam = searchParams.get('focus');
  const idParam = searchParams.get('id');
  const focus = isFocus(focusParam) ? focusParam : undefined;

  const state: Partial<InvestigationRouteState> = {
    focus,
    mode: isMode(searchParams.get('mode')) ? searchParams.get('mode') as OSMode : undefined,
    selectedProvider: searchParams.get('provider') ?? searchParams.get('npi'),
    selectedFinding: searchParams.get('findingId'),
    selectedStoryline: searchParams.get('storylineId'),
    selectedAction: searchParams.get('actionId'),
    selectedEvidence: searchParams.get('evidenceId'),
    graphFocus: searchParams.get('graphFocus'),
    queueCursor: searchParams.get('queue'),
    openPanels: searchParams
      .getAll('open')
      .map((value) => (isWorkspacePanel(value) ? value : null))
      .filter((value): value is WorkspacePanel => Boolean(value)),
    pinnedEntities: searchParams
      .getAll('pin')
      .map((value) => parsePinnedEntity(value))
      .filter((value): value is PinnedEntity => Boolean(value)),
    evidenceSort: isEvidenceSort(searchParams.get('evidenceSort')) ? searchParams.get('evidenceSort') as EvidenceSort : undefined,
    evidenceGroup: isEvidenceGroup(searchParams.get('evidenceGroup')) ? searchParams.get('evidenceGroup') as EvidenceGroup : undefined,
    evidenceDensity: isEvidenceDensity(searchParams.get('evidenceDensity')) ? searchParams.get('evidenceDensity') as EvidenceDensity : undefined,
  };

  if (focus === 'provider' && idParam) {
    state.selectedProvider = idParam;
  }
  if (focus === 'finding' && idParam) {
    state.selectedFinding = idParam;
  }
  if (focus === 'storyline' && idParam) {
    state.selectedStoryline = idParam;
  }
  if (focus === 'action' && idParam) {
    state.selectedAction = idParam;
  }

  return state;
}

export function parseInvestigationRouteState(searchParams: URLSearchParams): InvestigationRouteState {
  return normalizeInvestigationState(canonicalSelectionFromRoute(searchParams));
}

export function buildInvestigationSearchParams(state: InvestigationRouteState): URLSearchParams {
  const params = new URLSearchParams();

  if (state.focus !== 'dashboard') {
    params.set('focus', state.focus);
  }

  if (state.focus === 'provider' && state.selectedProvider) {
    params.set('id', state.selectedProvider);
  } else if (state.focus === 'finding' && state.selectedFinding) {
    params.set('id', state.selectedFinding);
  } else if (state.focus === 'storyline' && state.selectedStoryline) {
    params.set('id', state.selectedStoryline);
  } else if (state.focus === 'action' && state.selectedAction) {
    params.set('id', state.selectedAction);
  }

  if (state.mode !== inferModeFromSelections({ focus: state.focus })) {
    params.set('mode', state.mode);
  }

  if (state.selectedProvider && !(state.focus === 'provider' && params.get('id') === state.selectedProvider)) {
    params.set('provider', state.selectedProvider);
  }
  if (state.selectedFinding && !(state.focus === 'finding' && params.get('id') === state.selectedFinding)) {
    params.set('findingId', state.selectedFinding);
  }
  if (state.selectedStoryline && !(state.focus === 'storyline' && params.get('id') === state.selectedStoryline)) {
    params.set('storylineId', state.selectedStoryline);
  }
  if (state.selectedAction && !(state.focus === 'action' && params.get('id') === state.selectedAction)) {
    params.set('actionId', state.selectedAction);
  }
  if (state.selectedEvidence) {
    params.set('evidenceId', state.selectedEvidence);
  }
  if (state.graphFocus) {
    params.set('graphFocus', state.graphFocus);
  }
  if (state.queueCursor && state.queueCursor !== state.selectedFinding && state.queueCursor !== state.selectedStoryline && state.queueCursor !== state.selectedProvider && state.queueCursor !== state.selectedAction) {
    params.set('queue', state.queueCursor);
  }

  for (const panel of uniquePanels(state.openPanels)) {
    if (panel === 'graph' || panel === 'evidence' || panel === 'copilot') {
      continue;
    }
    params.append('open', panel);
  }

  for (const entity of uniquePinned(state.pinnedEntities)) {
    params.append('pin', `${entity.type}:${entity.id}`);
  }

  if (state.evidenceSort !== DEFAULT_STATE.evidenceSort) {
    params.set('evidenceSort', state.evidenceSort);
  }
  if (state.evidenceGroup !== DEFAULT_STATE.evidenceGroup) {
    params.set('evidenceGroup', state.evidenceGroup);
  }
  if (state.evidenceDensity !== DEFAULT_STATE.evidenceDensity) {
    params.set('evidenceDensity', state.evidenceDensity);
  }

  return params;
}

export function buildInvestigationHref(state: InvestigationRouteState): string {
  const searchParams = buildInvestigationSearchParams(state);
  const query = searchParams.toString();
  return `/intelligence${query ? `?${query}` : ''}`;
}

export const useInvestigationContextStore = create<InvestigationContextState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,
      hydrated: false,
      hydrateFromRoute: (state) => set({
        ...normalizeInvestigationState(state),
        hydrated: true,
      }),
      setFocus: (focus) => set((state) => mergeInvestigationState(state, { focus })),
      setFinding: (findingId, options = {}) => set((state) => mergeInvestigationState(state, {
        selectedFinding: findingId,
        selectedProvider: options.providerId ?? state.selectedProvider,
        selectedStoryline: options.storylineId ?? state.selectedStoryline,
        selectedAction: options.actionId ?? state.selectedAction,
        selectedEvidence: options.evidenceId ?? state.selectedEvidence,
        graphFocus: options.graphFocus ?? findingId ?? options.providerId ?? state.selectedProvider,
        focus: options.focus ?? (findingId ? 'finding' : state.focus),
        mode: options.mode ?? (findingId ? 'investigate' : state.mode),
        openPanels: mergeOpenPanels(options.openPanels ?? state.openPanels, ['finding', 'graph', 'evidence', 'copilot']),
        queueCursor: findingId ?? state.queueCursor,
      })),
      setProvider: (providerId, options = {}) => set((state) => mergeInvestigationState(state, {
        selectedProvider: providerId,
        selectedFinding: options.findingId ?? state.selectedFinding,
        selectedStoryline: options.storylineId ?? state.selectedStoryline,
        selectedAction: options.actionId ?? state.selectedAction,
        selectedEvidence: options.evidenceId ?? state.selectedEvidence,
        graphFocus: options.graphFocus ?? providerId,
        focus: options.focus ?? (providerId ? 'provider' : state.focus),
        mode: options.mode ?? (providerId ? 'investigate' : state.mode),
        openPanels: mergeOpenPanels(options.openPanels ?? state.openPanels, ['provider', 'graph', 'evidence', 'copilot']),
        queueCursor: providerId ?? state.queueCursor,
      })),
      setStoryline: (storylineId, options = {}) => set((state) => mergeInvestigationState(state, {
        selectedStoryline: storylineId,
        selectedProvider: options.providerId ?? state.selectedProvider,
        selectedFinding: options.findingId ?? state.selectedFinding,
        selectedAction: options.actionId ?? state.selectedAction,
        selectedEvidence: options.evidenceId ?? state.selectedEvidence,
        graphFocus: options.graphFocus ?? storylineId ?? state.selectedFinding ?? state.selectedProvider,
        focus: options.focus ?? (storylineId ? 'storyline' : state.focus),
        mode: options.mode ?? (storylineId ? 'investigate' : state.mode),
        openPanels: mergeOpenPanels(options.openPanels ?? state.openPanels, ['storyline', 'graph', 'evidence', 'copilot']),
        queueCursor: storylineId ?? state.queueCursor,
      })),
      setEvidence: (evidenceId) => set((state) => mergeInvestigationState(state, {
        selectedEvidence: evidenceId,
        openPanels: mergeOpenPanels(state.openPanels, ['evidence']),
      })),
      setAction: (actionId, options = {}) => set((state) => mergeInvestigationState(state, {
        selectedAction: actionId,
        selectedProvider: options.providerId ?? state.selectedProvider,
        selectedFinding: options.findingId ?? state.selectedFinding,
        selectedStoryline: options.storylineId ?? state.selectedStoryline,
        selectedEvidence: options.evidenceId ?? state.selectedEvidence,
        graphFocus: options.graphFocus ?? actionId ?? state.selectedFinding ?? state.selectedStoryline ?? state.selectedProvider,
        focus: options.focus ?? (actionId ? 'action' : state.focus),
        mode: options.mode ?? (actionId ? 'decide' : state.mode),
        openPanels: mergeOpenPanels(options.openPanels ?? state.openPanels, ['action', 'graph', 'evidence', 'copilot']),
        queueCursor: actionId ?? state.queueCursor,
      })),
      setMode: (mode) => set((state) => mergeInvestigationState(state, {
        mode,
        focus: mode === 'decide' ? 'actions' : state.focus === 'actions' ? 'investigations' : state.focus,
      })),
      setGraphFocus: (graphFocus) => set((state) => mergeInvestigationState(state, { graphFocus })),
      pinEntity: (entity) => set((state) => mergeInvestigationState(state, {
        pinnedEntities: uniquePinned([...state.pinnedEntities, entity]),
      })),
      unpinEntity: (entity) => set((state) => mergeInvestigationState(state, {
        pinnedEntities: state.pinnedEntities.filter((candidate) => !(candidate.type === entity.type && candidate.id === entity.id)),
      })),
      openPanel: (panel) => set((state) => mergeInvestigationState(state, {
        openPanels: uniquePanels([...state.openPanels, panel]),
      })),
      closePanel: (panel) => set((state) => mergeInvestigationState(state, {
        openPanels: state.openPanels.filter((candidate) => candidate !== panel),
      })),
      setQueueCursor: (queueCursor) => set((state) => mergeInvestigationState(state, { queueCursor })),
      setEvidenceSort: (evidenceSort) => set((state) => mergeInvestigationState(state, { evidenceSort })),
      setEvidenceGroup: (evidenceGroup) => set((state) => mergeInvestigationState(state, { evidenceGroup })),
      setEvidenceDensity: (evidenceDensity) => set((state) => mergeInvestigationState(state, { evidenceDensity })),
      resetFocus: () => set({
        ...DEFAULT_STATE,
        hydrated: true,
      }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }

        return window.localStorage;
      }),
      partialize: (state) => ({
        focus: state.focus,
        mode: state.mode,
        selectedProvider: state.selectedProvider,
        selectedFinding: state.selectedFinding,
        selectedStoryline: state.selectedStoryline,
        selectedEvidence: state.selectedEvidence,
        selectedAction: state.selectedAction,
        graphFocus: state.graphFocus,
        openPanels: state.openPanels,
        pinnedEntities: state.pinnedEntities,
        queueCursor: state.queueCursor,
        evidenceSort: state.evidenceSort,
        evidenceGroup: state.evidenceGroup,
        evidenceDensity: state.evidenceDensity,
      }),
    },
  ),
);

export function currentInvestigationState(): InvestigationRouteState {
  const state = useInvestigationContextStore.getState();
  return normalizeInvestigationState(state);
}
