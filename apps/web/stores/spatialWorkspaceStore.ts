'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  createWorkspacePage,
  type SpatialEntityType,
  type SpatialWorkspaceFilters,
  type SpatialWorkspaceRouteState,
  type SpatialWorkspaceView,
  type WorkspacePage,
  type WorkspaceViewport,
  DEFAULT_SPATIAL_WORKSPACE_VIEW,
  DEFAULT_WORKSPACE_VIEWPORT,
} from '@/lib/intelligence/spatial-workspace';

interface OpenPageOptions {
  sourcePageKey?: string | null;
  label?: string | null;
  subtitle?: string | null;
}

export interface SpatialWorkspaceStoreState {
  view: SpatialWorkspaceView;
  filters: SpatialWorkspaceFilters;
  selectedNode: string | null;
  hoveredNode: string | null;
  graphFocus: string | null;
  focusRevision: number;
  openPages: WorkspacePage[];
  viewport: WorkspaceViewport;
  hydrateFromRoute: (routeState: SpatialWorkspaceRouteState) => void;
  setView: (view: SpatialWorkspaceView) => void;
  setFilters: (filters: Partial<SpatialWorkspaceFilters>) => void;
  setViewport: (viewport: Partial<WorkspaceViewport>) => void;
  setHoveredNode: (key: string | null) => void;
  setSelectedNode: (key: string | null) => void;
  setGraphFocus: (key: string | null) => void;
  focusPage: (key: string) => void;
  closePage: (key: string) => void;
  openPage: (page: WorkspacePage, options?: OpenPageOptions) => void;
  openEntity: (type: SpatialEntityType, entityId: string, options?: OpenPageOptions) => void;
}

const DEFAULT_FILTERS: SpatialWorkspaceFilters = {
  q: '',
  provider: '',
  severity: [],
  status: [],
  type: [],
  storylineType: '',
  perspective: '',
  minConfidence: '',
  minTrustScore: '',
  investigatorId: '',
  dateFrom: '',
  dateTo: '',
};

const INITIAL_STATE = {
  view: DEFAULT_SPATIAL_WORKSPACE_VIEW,
  filters: DEFAULT_FILTERS,
  selectedNode: null,
  hoveredNode: null,
  graphFocus: null,
  focusRevision: 0,
  openPages: [] as WorkspacePage[],
  viewport: DEFAULT_WORKSPACE_VIEWPORT,
};

function resolveNextSelectedPageKey(openPages: readonly WorkspacePage[], closingKey: string): string | null {
  const index = openPages.findIndex((page) => page.key === closingKey);
  if (index === -1) {
    return openPages[openPages.length - 1]?.key ?? null;
  }

  const nextPage = openPages[index + 1] ?? openPages[index - 1] ?? null;
  return nextPage?.key ?? null;
}

const PERSIST_KEY = 'vitalcv_spatial_workspace_v1';

export const useSpatialWorkspaceStore = create<SpatialWorkspaceStoreState>()(
  persist(
    (set, get) => ({
  ...INITIAL_STATE,

  hydrateFromRoute: (routeState) => {
    set({
      view: routeState.view,
      filters: routeState.filters,
      selectedNode: routeState.selectedNode,
      hoveredNode: null,
      graphFocus: routeState.graphFocus,
      focusRevision: 0,
      openPages: routeState.openPages,
      viewport: routeState.viewport,
    });
  },

  setView: (view) => set({ view }),

  setFilters: (filters) => set((state) => ({
    filters: {
      ...state.filters,
      ...filters,
    },
  })),

  setViewport: (viewport) => set((state) => ({
    viewport: {
      ...state.viewport,
      ...viewport,
    },
  })),

  setHoveredNode: (key) => set({ hoveredNode: key }),
  setSelectedNode: (key) => set({ selectedNode: key }),
  setGraphFocus: (key) => set({ graphFocus: key }),

  focusPage: (key) => {
    const page = get().openPages.find((candidate) => candidate.key === key);
    if (!page) {
      return;
    }

    set({
      selectedNode: key,
      graphFocus: key,
      focusRevision: get().focusRevision + 1,
    });
  },

  closePage: (key) => set((state) => {
    if (!state.openPages.some((page) => page.key === key)) {
      return state;
    }

    const nextOpenPages = state.openPages.filter((page) => page.key !== key);
    const nextSelectedNode = state.selectedNode === key
      ? resolveNextSelectedPageKey(state.openPages, key)
      : state.selectedNode;
    const nextGraphFocus = state.graphFocus === key ? nextSelectedNode : state.graphFocus;

    return {
      openPages: nextOpenPages,
      selectedNode: nextSelectedNode,
      graphFocus: nextGraphFocus,
      hoveredNode: state.hoveredNode === key ? null : state.hoveredNode,
    };
  }),

  openPage: (page, options) => set((state) => {
    const existingIndex = state.openPages.findIndex((candidate) => candidate.key === page.key);

    if (existingIndex !== -1) {
      return {
        openPages: state.openPages.map((candidate, index) => (
          index === existingIndex
            ? {
              ...candidate,
              label: options?.label ?? page.label ?? candidate.label ?? null,
              subtitle: options?.subtitle ?? page.subtitle ?? candidate.subtitle ?? null,
            }
            : candidate
        )),
        selectedNode: page.key,
        graphFocus: page.key,
        focusRevision: state.focusRevision + 1,
      };
    }

    const nextPage: WorkspacePage = {
      ...page,
      sourcePageKey: options?.sourcePageKey ?? page.sourcePageKey ?? null,
      label: options?.label ?? page.label ?? null,
      subtitle: options?.subtitle ?? page.subtitle ?? null,
    };
    const nextOpenPages = [...state.openPages];
    const sourcePageKey = options?.sourcePageKey ?? page.sourcePageKey ?? null;

    if (sourcePageKey) {
      const sourceIndex = nextOpenPages.findIndex((candidate) => candidate.key === sourcePageKey);
      if (sourceIndex !== -1) {
        nextOpenPages.splice(sourceIndex + 1, 0, nextPage);
      } else {
        nextOpenPages.push(nextPage);
      }
    } else {
      nextOpenPages.push(nextPage);
    }

    return {
      openPages: nextOpenPages,
      selectedNode: nextPage.key,
      graphFocus: nextPage.key,
      focusRevision: state.focusRevision + 1,
    };
  }),

  openEntity: (type, entityId, options) => {
    const page = createWorkspacePage(type, entityId, {
      sourcePageKey: options?.sourcePageKey ?? null,
      label: options?.label ?? null,
      subtitle: options?.subtitle ?? null,
    });
    get().openPage(page, options);
  },
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => {
        // Safe localStorage access (SSR guard)
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return window.localStorage;
      }),
      // Only persist canvas state — filters and hover are transient
      partialize: (state) => ({
        view: state.view,
        openPages: state.openPages,
        selectedNode: state.selectedNode,
        graphFocus: state.graphFocus,
        viewport: state.viewport,
      }),
    },
  ),
);
