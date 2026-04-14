import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeFetch, SafeFetchError } from '@/lib/safe-fetch';

function mockResponse(init: {
  ok?: boolean;
  status?: number;
  body?: unknown;
  invalidJson?: boolean;
}): Response {
  const status = init.status ?? (init.ok === false ? 500 : 200);
  const body = init.invalidJson ? 'not-json' : JSON.stringify(init.body ?? {});
  return {
    ok: init.ok ?? (status >= 200 && status < 300),
    status,
    json: async () => {
      if (init.invalidJson) throw new SyntaxError('Unexpected token');
      return JSON.parse(body);
    },
    text: async () => body,
  } as Response;
}

describe('safeFetch three-condition contract', () => {
  const fetchMock = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('resolves when HTTP ok + success:true + recorded:true', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ body: { success: true, recorded: true, action: 'flag' } }),
    );
    const result = await safeFetch('/api/employer-actions', { method: 'POST' });
    expect(result.success).toBe(true);
    expect(result.recorded).toBe(true);
  });

  it('resolves when HTTP ok + success:true + routed (delegated persistence)', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ body: { success: true, routed: 'acceptance_system' } }),
    );
    const result = await safeFetch('/api/employer-actions', { method: 'POST' });
    expect(result.routed).toBe('acceptance_system');
  });

  it('throws SafeFetchError at http layer when res.ok is false', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ ok: false, status: 500, body: { error: 'boom' } }),
    );
    await expect(safeFetch('/api/employer-actions')).rejects.toMatchObject({
      name: 'SafeFetchError',
      layer: 'http',
      status: 500,
    });
  });

  it('throws at application layer when success is false', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ body: { success: false, error: 'persist_failed' } }),
    );
    await expect(safeFetch('/api/employer-actions')).rejects.toMatchObject({
      name: 'SafeFetchError',
      layer: 'application',
    });
  });

  it('throws at persistence layer when success:true but recorded/routed missing', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ body: { success: true, recorded: false } }),
    );
    await expect(safeFetch('/api/employer-actions')).rejects.toMatchObject({
      name: 'SafeFetchError',
      layer: 'persistence',
    });
  });

  it('throws at network layer when fetch itself rejects', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    await expect(safeFetch('/api/employer-actions')).rejects.toMatchObject({
      name: 'SafeFetchError',
      layer: 'network',
    });
  });

  it('does not enforce persistence when neither recorded nor routed is present in the response', async () => {
    // Used for endpoints whose contract does not include persistence fields.
    fetchMock.mockResolvedValue(
      mockResponse({ body: { success: true, data: { foo: 'bar' } } }),
    );
    const result = await safeFetch('/api/anything-else');
    expect(result.success).toBe(true);
  });
});
