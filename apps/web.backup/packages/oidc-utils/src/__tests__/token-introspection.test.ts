import { describe, expect, it, vi } from 'vitest';
import { introspectToken } from '../token-introspection';

describe('token introspection', () => {
  it('handles active response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        active: true,
        sub: 'user-123',
      }),
    });

    const result = await introspectToken('token-abc', {
      endpoint: 'https://idp/introspect',
      clientId: 'client',
      clientSecret: 'secret',
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(result.active).toBe(true);
    expect(result.sub).toBe('user-123');
  });

  it('returns inactive response when server errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const result = await introspectToken('token-xyz', {
      endpoint: 'https://idp/introspect',
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    expect(result.active).toBe(false);
    expect(result.error).toContain('status 500');
  });
});

