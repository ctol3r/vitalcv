// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useHybridProviderData } from '../hooks/useHybridProviderData';
import {
  clearIdentity,
  readIdentity,
  writeIdentity,
} from '../lib/hybrid-loader/identityCache';
import {
  createInitialIngestStreamState,
  type IngestStreamState,
} from '../hooks/ingestStreamState';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NPI = '1234567890';

// ── Mock EventSource ─────────────────────────────────────────────────────────
// Same shape as use-ingest-stream.test.tsx — progressive hydration is owned by
// useIngestStream under the hood, and this wrapper delegates to it.

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly url: string;
  readonly listeners = new Map<string, Set<(event: MessageEvent<string>) => void>>();
  closed = false;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event?: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventListener): void {
    const handlers = this.listeners.get(type) ?? new Set<(event: MessageEvent<string>) => void>();
    handlers.add(listener as unknown as (event: MessageEvent<string>) => void);
    this.listeners.set(type, handlers);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, payload: unknown): void {
    const event = { data: JSON.stringify(payload) } as MessageEvent<string>;
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

// ── Harness ──────────────────────────────────────────────────────────────────

interface HarnessProps {
  dataKey: string | null | undefined;
  ssrSeed?: IngestStreamState | null;
  autoStart?: boolean;
}

function Harness(props: HarnessProps) {
  const { state } = useHybridProviderData({
    key: props.dataKey,
    ssrSeed: props.ssrSeed,
    autoStart: props.autoStart,
  });

  return (
    <pre data-testid="state">
      {JSON.stringify({
        phase: state.phase,
        isUsable: state.isUsable,
        displayName: state.identity.displayName ?? null,
        anchorEntityId: state.anchorEntityId ?? null,
      })}
    </pre>
  );
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderHarness(props: HarnessProps) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<Harness {...props} />);
  });
  await flush();

  return {
    container,
    async rerender(next: HarnessProps) {
      await act(async () => {
        root.render(<Harness {...next} />);
      });
      await flush();
    },
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function readState(container: HTMLElement): Record<string, unknown> {
  const node = container.querySelector<HTMLElement>('[data-testid="state"]');
  if (!node?.textContent) {
    throw new Error('Missing state node');
  }
  return JSON.parse(node.textContent) as Record<string, unknown>;
}

function buildSeed(overrides: Partial<IngestStreamState> = {}): IngestStreamState {
  const base = createInitialIngestStreamState();
  return {
    ...base,
    phase: 'done',
    isUsable: true,
    anchorEntityId: 'entity-seed',
    readyAt: '2026-04-10T12:00:00.000Z',
    identity: {
      entityId: 'entity-seed',
      displayName: 'SSR Seed Name',
      specialty: 'Cardiology',
      entityType: 'PERSON',
      status: 'ACTIVE',
      authoritative: true,
    },
    ...overrides,
  };
}

describe('useHybridProviderData', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    window.localStorage.clear();
    vi.unstubAllGlobals();
    // Default: no-op fetch so auto-start effects don't explode on accidental runs.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ runId: 'run-test' }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }),
    ));
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  describe('initial state precedence (SSR > cache > empty)', () => {
    it('uses the SSR seed on first paint even when cache is also populated', async () => {
      // Cache says "Old Cached Name" — SSR says "SSR Seed Name".
      writeIdentity(NPI, {
        identity: {
          entityId: 'entity-cached',
          displayName: 'Old Cached Name',
          entityType: 'PERSON',
          status: 'ACTIVE',
          authoritative: true,
        },
      });

      const view = await renderHarness({
        dataKey: NPI,
        ssrSeed: buildSeed(),
        autoStart: false,
      });

      try {
        expect(readState(view.container)).toMatchObject({
          displayName: 'SSR Seed Name',
          isUsable: true,
        });
      } finally {
        await view.unmount();
      }
    });

    it('uses the cache on first paint when no SSR seed is provided', async () => {
      writeIdentity(NPI, {
        identity: {
          entityId: 'entity-cached',
          displayName: 'Cached Name',
          entityType: 'PERSON',
          status: 'ACTIVE',
          authoritative: true,
        },
      });

      const view = await renderHarness({ dataKey: NPI, autoStart: false });

      try {
        expect(readState(view.container)).toMatchObject({
          displayName: 'Cached Name',
          isUsable: true,
          anchorEntityId: 'entity-cached',
        });
      } finally {
        await view.unmount();
      }
    });

    it('falls through to the default empty state when no SSR seed and no cache', async () => {
      const view = await renderHarness({ dataKey: NPI, autoStart: false });

      try {
        expect(readState(view.container)).toMatchObject({
          isUsable: false,
          displayName: null,
        });
      } finally {
        await view.unmount();
      }
    });

    it('renders the empty default when the key is null (no cache lookup)', async () => {
      const view = await renderHarness({ dataKey: null, autoStart: false });

      try {
        expect(readState(view.container)).toMatchObject({
          isUsable: false,
          displayName: null,
        });
      } finally {
        await view.unmount();
      }
    });
  });

  describe('auto-start behaviour', () => {
    it('auto-starts an ingest run for a 10-digit NPI key', async () => {
      const view = await renderHarness({ dataKey: NPI });
      try {
        // The ingest kicks off fetch + EventSource. One EventSource instance
        // is proof that startIngest ran.
        expect(MockEventSource.instances).toHaveLength(1);
      } finally {
        await view.unmount();
      }
    });

    it('does not auto-start when the key is not NPI-shaped', async () => {
      const view = await renderHarness({ dataKey: 'entity-abc', autoStart: true });
      try {
        expect(MockEventSource.instances).toHaveLength(0);
      } finally {
        await view.unmount();
      }
    });

    it('does not auto-start when autoStart is false', async () => {
      const view = await renderHarness({ dataKey: NPI, autoStart: false });
      try {
        expect(MockEventSource.instances).toHaveLength(0);
      } finally {
        await view.unmount();
      }
    });
  });

  describe('write-through cache', () => {
    it('persists authoritative state to cache when SSE becomes usable', async () => {
      // Start with no cache, NPI key, autoStart true so SSE fires.
      expect(readIdentity(NPI)).toBeNull();

      const view = await renderHarness({ dataKey: NPI });

      try {
        const stream = MockEventSource.instances[0];
        expect(stream).toBeDefined();

        // Drive the stream all the way to passport_ready so state.isUsable flips.
        await act(async () => {
          stream!.emit('source_start', {
            type: 'source_start',
            sourceId: 'nppes',
            timestamp: '2026-04-10T12:00:00.000Z',
            payload: { sourceId: 'nppes' },
          });
        });
        await act(async () => {
          stream!.emit('source_complete', {
            type: 'source_complete',
            sourceId: 'nppes',
            timestamp: '2026-04-10T12:00:01.000Z',
            payload: {
              sourceId: 'nppes',
              resultStatus: 'SUCCESS',
              entityId: 'entity-live',
              displayName: 'Live Ada Lovelace',
              identityStatus: 'ACTIVE',
            },
          });
        });
        await act(async () => {
          stream!.emit('passport_ready', {
            type: 'passport_ready',
            timestamp: '2026-04-10T12:00:02.000Z',
            payload: {
              entityId: 'entity-live',
              displayName: 'Live Ada Lovelace',
              identityStatus: 'ACTIVE',
              readinessScore: 91,
              readinessLevel: 'L3',
              readinessStatus: 'READY',
              exclusionChecked: true,
              exclusionClear: true,
              exclusionStatus: 'CLEAR',
              enrollmentChecked: true,
              enrollmentStatus: 'ENROLLED',
            },
          });
        });
        await flush();

        // UI reflects the live payload.
        expect(readState(view.container)).toMatchObject({
          isUsable: true,
          displayName: 'Live Ada Lovelace',
          anchorEntityId: 'entity-live',
        });

        // Cache has been written through with the same identity.
        const cached = readIdentity(NPI);
        expect(cached).not.toBeNull();
        expect(cached?.identity.displayName).toBe('Live Ada Lovelace');
        expect(cached?.identity.authoritative).toBe(true);
        expect(cached?.standing?.exclusionStatus).toBe('CLEAR');
        expect(cached?.readiness?.level).toBe('L3');
      } finally {
        clearIdentity(NPI);
        await view.unmount();
      }
    });

    it('does not write to cache when state is not yet usable', async () => {
      // No seed, no cache, and autoStart disabled — state stays at default,
      // isUsable stays false, so no write-through fires.
      const view = await renderHarness({ dataKey: NPI, autoStart: false });

      try {
        expect(readIdentity(NPI)).toBeNull();
      } finally {
        await view.unmount();
      }
    });
  });
});
