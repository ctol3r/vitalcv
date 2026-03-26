// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useIngestStream } from '../hooks/useIngestStream';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

function Harness() {
  const { state, startIngest } = useIngestStream();

  return (
    <div>
      <button type="button" onClick={() => void startIngest('1234567890')}>
        Start
      </button>
      <pre data-testid="state">
        {JSON.stringify({
          phase: state.phase,
          isUsable: state.isUsable,
          anchorEntityId: state.anchorEntityId ?? null,
          displayName: state.identity.displayName ?? null,
          claimCount: state.readiness.claimCount ?? null,
          error: state.error ?? null,
        })}
      </pre>
    </div>
  );
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderHarness() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<Harness />);
  });
  await flush();

  return {
    container,
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

async function clickStart(container: HTMLElement): Promise<void> {
  const button = container.querySelector<HTMLButtonElement>('button');
  if (!button) {
    throw new Error('Missing start button');
  }

  await act(async () => {
    button.click();
  });
  await flush();
}

async function emitStreamEvent(
  stream: MockEventSource | undefined,
  type: string,
  payload: unknown,
): Promise<void> {
  if (!stream) {
    throw new Error('Missing EventSource instance');
  }

  await act(async () => {
    stream.emit(type, payload);
  });
  await flush();
}

describe('useIngestStream', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.unstubAllGlobals();
  });

  it('consumes named SSE events through addEventListener and becomes usable on passport_ready', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ runId: 'run-1' }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }),
    ));
    vi.stubGlobal('EventSource', MockEventSource);

    const view = await renderHarness();

    try {
      await clickStart(view.container);

      const stream = MockEventSource.instances[0];
      expect(stream?.url).toBe('/api/ingest/stream/run-1');

      await emitStreamEvent(stream, 'source_start', {
        type: 'source_start',
        sourceId: 'nppes',
        timestamp: '2026-03-25T22:00:00.000Z',
        payload: { sourceId: 'nppes' },
      });
      await emitStreamEvent(stream, 'source_complete', {
        type: 'source_complete',
        sourceId: 'nppes',
        timestamp: '2026-03-25T22:00:01.000Z',
        payload: {
          sourceId: 'nppes',
          resultStatus: 'SUCCESS',
          entityId: 'entity-1',
          displayName: 'Ada Lovelace',
          identityStatus: 'ACTIVE',
        },
      });
      await emitStreamEvent(stream, 'claim_update', {
        type: 'claim_update',
        sourceId: 'nppes',
        timestamp: '2026-03-25T22:00:02.000Z',
        payload: {
          sourceId: 'nppes',
          claimCount: 3,
          credentialIds: ['cred-1', 'cred-2'],
        },
      });
      await emitStreamEvent(stream, 'source_start', {
        type: 'source_start',
        sourceId: 'fsmb',
        timestamp: '2026-03-25T22:00:02.500Z',
        payload: { sourceId: 'fsmb' },
      });
      await emitStreamEvent(stream, 'source_complete', {
        type: 'source_complete',
        sourceId: 'fsmb',
        timestamp: '2026-03-25T22:00:02.750Z',
        payload: {
          sourceId: 'fsmb',
          resultStatus: 'FAILED',
          route: 'manual',
          error: 'CA physician licensure lane requires source access',
        },
      });
      await emitStreamEvent(stream, 'passport_ready', {
        type: 'passport_ready',
        timestamp: '2026-03-25T22:00:03.000Z',
        payload: {
          entityId: 'entity-1',
          displayName: 'Ada Lovelace',
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

      expect(readState(view.container)).toMatchObject({
        isUsable: true,
        anchorEntityId: 'entity-1',
        displayName: 'Ada Lovelace',
        claimCount: 3,
      });

      await emitStreamEvent(stream, 'done', {
        type: 'done',
        timestamp: '2026-03-25T22:00:04.000Z',
        payload: {
          entityId: 'entity-1',
        },
      });

      expect(stream?.closed).toBe(true);
      expect(readState(view.container)).toMatchObject({
        phase: 'done',
        isUsable: true,
      });
    } finally {
      await view.unmount();
    }
  });

  it('surfaces a start error and never opens EventSource when the runId is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ));
    vi.stubGlobal('EventSource', MockEventSource);

    const view = await renderHarness();

    try {
      await clickStart(view.container);

      expect(MockEventSource.instances).toHaveLength(0);
      expect(readState(view.container)).toMatchObject({
        phase: 'error',
        error: 'Ingest run did not return a runId.',
      });
    } finally {
      await view.unmount();
    }
  });
});
