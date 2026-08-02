/**
 * Regression: the FSMB and Nursys PSV adapters must never manufacture an
 * ACTIVE licence from a response they did not understand.
 *
 * The original defect: `normalize()` in both adapters returned ACTIVE for any
 * payload that was not the adapter's own stub sentinel. Nursys fetched a public
 * HTML page with no credentials; the HTML failed JSON.parse, fell through as
 * `{ raw: text }`, and normalized to ACTIVE with an empty licence number.
 *
 * That mattered because ACTIVE is not inert downstream:
 *   - `app.ts` maps `artifact.status === 'ACTIVE'` to `VERIFIED`
 *   - `psvOrchestrator.ts` counts ACTIVE artifacts into `readinessScore`
 *
 * These tests drive `normalize` through the real `fetchArtifact` path with a
 * stubbed global fetch, so they exercise the shipped code rather than the
 * private method in isolation.
 */
import { FsmbAdapter } from '../fsmbAdapter';
import { NursysENotifyAdapter } from '../nursysAdapter';

const NPI = '1234567893';

const ENV_KEYS = [
  'FSMB_API_KEY',
  'FSMB_API_URL',
  'NURSYS_BASE_URL',
  'NURSYS_CLIENT_ID',
  'NURSYS_CLIENT_SECRET',
] as const;

let savedEnv: Record<string, string | undefined>;
const originalFetch = global.fetch;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  global.fetch = originalFetch;
});

function mockFetch(body: string, ok = true, status = 200): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    headers: { get: () => null },
    text: async () => body,
    json: async () => JSON.parse(body),
  }) as unknown as typeof global.fetch;
}

describe('Nursys adapter fails closed', () => {
  it('makes no network call when credentials are absent', async () => {
    const spy = jest.fn();
    global.fetch = spy as unknown as typeof global.fetch;

    const artifact = await new NursysENotifyAdapter().fetchArtifact(NPI);

    expect(spy).not.toHaveBeenCalled();
    expect(artifact.status).toBe('ERROR');
  });

  it('does not report ACTIVE for an HTML page (the original defect)', async () => {
    process.env.NURSYS_BASE_URL = 'https://nursys.example';
    process.env.NURSYS_CLIENT_ID = 'id';
    process.env.NURSYS_CLIENT_SECRET = 'secret';
    mockFetch('<!DOCTYPE html><html><body>Service unavailable</body></html>');

    const artifact = await new NursysENotifyAdapter().fetchArtifact(NPI);

    expect(artifact.status).toBe('ERROR');
    expect(artifact.status).not.toBe('ACTIVE');
  });

  it('does not report ACTIVE for JSON with no status field', async () => {
    process.env.NURSYS_BASE_URL = 'https://nursys.example';
    process.env.NURSYS_CLIENT_ID = 'id';
    process.env.NURSYS_CLIENT_SECRET = 'secret';
    mockFetch(JSON.stringify({ message: 'rate limit exceeded' }));

    const artifact = await new NursysENotifyAdapter().fetchArtifact(NPI);
    expect(artifact.status).toBe('ERROR');
  });

  it('does not report ACTIVE for an unmapped status string', async () => {
    process.env.NURSYS_BASE_URL = 'https://nursys.example';
    process.env.NURSYS_CLIENT_ID = 'id';
    process.env.NURSYS_CLIENT_SECRET = 'secret';
    mockFetch(JSON.stringify({ licenseStatus: 'ENCUMBERED' }));

    const artifact = await new NursysENotifyAdapter().fetchArtifact(NPI);
    expect(artifact.status).toBe('ERROR');
  });

  it('reports ACTIVE only for an explicit recognized status', async () => {
    process.env.NURSYS_BASE_URL = 'https://nursys.example';
    process.env.NURSYS_CLIENT_ID = 'id';
    process.env.NURSYS_CLIENT_SECRET = 'secret';
    mockFetch(JSON.stringify({ licenseStatus: 'ACTIVE', licenseNumber: 'RN-1', state: 'CA' }));

    const artifact = await new NursysENotifyAdapter().fetchArtifact(NPI);
    expect(artifact.status).toBe('ACTIVE');
    expect(artifact.licenseNumber).toBe('RN-1');
  });
});

describe('FSMB adapter fails closed', () => {
  it('reports ERROR, not NOT_FOUND, when no API key is configured', async () => {
    // NOT_FOUND would read as "no licence exists". We simply could not look.
    const artifact = await new FsmbAdapter().fetchArtifact(NPI);
    expect(artifact.status).toBe('ERROR');
  });

  it('does not report ACTIVE for an error body (the original defect)', async () => {
    process.env.FSMB_API_KEY = 'k';
    mockFetch(JSON.stringify({ error: 'unauthorized' }));

    const artifact = await new FsmbAdapter().fetchArtifact(NPI);

    expect(artifact.status).toBe('ERROR');
    expect(artifact.status).not.toBe('ACTIVE');
  });

  it('does not report ACTIVE for a non-2xx response', async () => {
    process.env.FSMB_API_KEY = 'k';
    mockFetch(JSON.stringify({ message: 'forbidden' }), false, 403);

    const artifact = await new FsmbAdapter().fetchArtifact(NPI);
    expect(artifact.status).toBe('ERROR');
  });

  it('reports ACTIVE only for an explicit recognized status', async () => {
    process.env.FSMB_API_KEY = 'k';
    mockFetch(JSON.stringify({ status: 'ACTIVE', state: 'TX', licenseNumber: 'TX-9' }));

    const artifact = await new FsmbAdapter().fetchArtifact(NPI);
    expect(artifact.status).toBe('ACTIVE');
    expect(artifact.state).toBe('TX');
  });
});
