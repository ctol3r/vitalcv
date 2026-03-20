import { describe, expect, it } from 'vitest';
import { parseSpatialWorkspaceRouteState } from '@/lib/intelligence/spatial-workspace';
import { useSpatialWorkspaceStore } from '@/stores/spatialWorkspaceStore';

function resetStore() {
  useSpatialWorkspaceStore.getState().hydrateFromRoute(parseSpatialWorkspaceRouteState(new URLSearchParams()));
}

describe('spatial workspace store', () => {
  it('opens a new entity once and focuses it', () => {
    resetStore();

    useSpatialWorkspaceStore.getState().openEntity('provider', '1234567890', {
      label: 'Ada Lovelace',
    });
    useSpatialWorkspaceStore.getState().openEntity('provider', '1234567890', {
      label: 'Ada Lovelace',
    });

    const state = useSpatialWorkspaceStore.getState();
    expect(state.openPages).toHaveLength(1);
    expect(state.openPages[0]?.key).toBe('provider:1234567890');
    expect(state.selectedNode).toBe('provider:1234567890');
    expect(state.graphFocus).toBe('provider:1234567890');
  });

  it('inserts backlink pages immediately to the right of the source page', () => {
    resetStore();

    useSpatialWorkspaceStore.getState().openEntity('provider', '1234567890');
    useSpatialWorkspaceStore.getState().openEntity('storyline', 'story-1', {
      sourcePageKey: 'provider:1234567890',
    });
    useSpatialWorkspaceStore.getState().openEntity('finding', 'finding-1', {
      sourcePageKey: 'provider:1234567890',
    });

    expect(useSpatialWorkspaceStore.getState().openPages.map((page) => page.key)).toEqual([
      'provider:1234567890',
      'finding:finding-1',
      'storyline:story-1',
    ]);
  });

  it('hydrates route state including selected page and viewport', () => {
    resetStore();

    const routeState = parseSpatialWorkspaceRouteState(new URLSearchParams(
      'view=providers&open=provider%3A1234567890&selected=provider%3A1234567890&x=12&y=18&zoom=1.2',
    ));
    useSpatialWorkspaceStore.getState().hydrateFromRoute(routeState);

    const state = useSpatialWorkspaceStore.getState();
    expect(state.view).toBe('providers');
    expect(state.selectedNode).toBe('provider:1234567890');
    expect(state.viewport).toEqual({
      x: 12,
      y: 18,
      zoom: 1.2,
    });
  });
});

