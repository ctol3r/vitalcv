/**
 * Regression: the DCA BreEZe PSV adapter must never manufacture an ACTIVE
 * licence, and must not call the public DCA search surface ungated.
 *
 * The headline defect: `normalize()` classified INACTIVE as ACTIVE. It tested
 * `statusStr.includes('ACTIVE')` before the INACTIVE arm, and
 * `'INACTIVE'.includes('ACTIVE')` is true — so the INACTIVE branch was
 * unreachable dead code and a licence the board reports as INACTIVE was
 * published as verified. 'NOT CURRENT' fell the same way via
 * `includes('CURRENT')`.
 *
 * That mattered because this adapter is wired, unlike the NCCPA placeholders:
 *   - registered in `adapterRegistry.ts` and reached via `runDeltaScan`
 *   - `app.ts` maps `artifact.status === 'ACTIVE'` to `VERIFIED`
 *   - `psvOrchestrator.ts` counts ACTIVE artifacts into `readinessScore`
 *
 * These tests drive `normalize` through the real `fetchArtifact` path with a
 * stubbed global fetch, so they exercise the shipped code rather than the
 * private method in isolation — the same method as
 * `adapterFailClosed.test.ts`, whose sweep missed this adapter.
 */
import { DcaBreezeAdapter } from '../dcaBreezeAdapter';

const NPI = '1234567893';

const ENV_KEYS = ['STATE_BOARD_MODE', 'DCA_BREEZE_API_URL'] as const;

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

/** Put the adapter past its access gate so normalize() can be exercised. */
function enableLiveMode(): void {
  process.env.STATE_BOARD_MODE = 'live';
}

function mockFetch(body: string, ok = true, status = 200): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    headers: { get: () => null },
    text: async () => body,
    json: async () => JSON.parse(body),
  }) as unknown as typeof global.fetch;
}

describe('DCA BreEZe adapter does not fabricate ACTIVE', () => {
  // This is the injection-proof case: restore the old substring logic and
  // this test — and only this class of test — goes red.
  it('does not report ACTIVE for INACTIVE (the original defect)', async () => {
    enableLiveMode();
    mockFetch(JSON.stringify({ status: 'INACTIVE', licenseNumber: 'A-1' }));

    const artifact = await new DcaBreezeAdapter().fetchArtifact(NPI);

    expect(artifact.status).not.toBe('ACTIVE');
    expect(artifact.status).toBe('EXPIRED');
  });

  it('does not report ACTIVE for NOT CURRENT', async () => {
    enableLiveMode();
    mockFetch(JSON.stringify({ status: 'NOT CURRENT' }));

    const artifact = await new DcaBreezeAdapter().fetchArtifact(NPI);

    // Unrecognized by the board vocabulary — ERROR, and never ACTIVE.
    expect(artifact.status).not.toBe('ACTIVE');
    expect(artifact.status).toBe('ERROR');
  });

  it('does not report ACTIVE for a compound status containing ACTIVE', async () => {
    enableLiveMode();
    mockFetch(JSON.stringify({ status: 'DELINQUENT-INACTIVE' }));

    const artifact = await new DcaBreezeAdapter().fetchArtifact(NPI);
    expect(artifact.status).not.toBe('ACTIVE');
  });

  it('does not report ACTIVE for an unmapped status string', async () => {
    enableLiveMode();
    mockFetch(JSON.stringify({ status: 'PROBATION' }));

    const artifact = await new DcaBreezeAdapter().fetchArtifact(NPI);
    expect(artifact.status).toBe('ERROR');
  });

  it('does not report ACTIVE for JSON with no status field', async () => {
    enableLiveMode();
    mockFetch(JSON.stringify({ message: 'rate limit exceeded' }));

    const artifact = await new DcaBreezeAdapter().fetchArtifact(NPI);
    expect(artifact.status).toBe('ERROR');
  });

  it('does not report ACTIVE for an HTML body', async () => {
    enableLiveMode();
    mockFetch('<!DOCTYPE html><html><body>Access denied</body></html>');

    const artifact = await new DcaBreezeAdapter().fetchArtifact(NPI);
    expect(artifact.status).toBe('ERROR');
  });

  it('does not report ACTIVE for a non-2xx response', async () => {
    enableLiveMode();
    mockFetch(JSON.stringify({ message: 'forbidden' }), false, 403);

    const artifact = await new DcaBreezeAdapter().fetchArtifact(NPI);
    expect(artifact.status).toBe('ERROR');
  });

  it('reports ACTIVE only for an explicit recognized status', async () => {
    enableLiveMode();
    mockFetch(JSON.stringify({ status: 'ACTIVE', licenseNumber: 'A-9', expirationDate: '2027-01-31' }));

    const artifact = await new DcaBreezeAdapter().fetchArtifact(NPI);

    expect(artifact.status).toBe('ACTIVE');
    expect(artifact.licenseNumber).toBe('A-9');
    expect(artifact.state).toBe('CA');
    expect(artifact.expiresAt).toBe('2027-01-31');
  });
});

describe('DCA BreEZe adapter gates its network access', () => {
  it('makes no network call when STATE_BOARD_MODE is not live', async () => {
    const spy = jest.fn();
    global.fetch = spy as unknown as typeof global.fetch;

    const artifact = await new DcaBreezeAdapter().fetchArtifact(NPI);

    expect(spy).not.toHaveBeenCalled();
    expect(artifact.status).toBe('ERROR');
  });

  it('makes no network call in explicit sandbox mode', async () => {
    process.env.STATE_BOARD_MODE = 'sandbox';
    const spy = jest.fn();
    global.fetch = spy as unknown as typeof global.fetch;

    const artifact = await new DcaBreezeAdapter().fetchArtifact(NPI);

    expect(spy).not.toHaveBeenCalled();
    expect(artifact.status).toBe('ERROR');
  });
});

describe('DCA BreEZe adapter never reports NOT_FOUND', () => {
  // BreEZe search is name-based and fuzzy, and this adapter queries by NPI,
  // which BreEZe does not index. Absence of a result is not proof of absence
  // of a licence, so NOT_FOUND — a finding about the practitioner — is never
  // available to this adapter.
  it.each([
    ['ungated (no live mode)', null],
    ['explicit NOT_FOUND error field', JSON.stringify({ error: 'NOT_FOUND' })],
    ['empty result set', JSON.stringify({ results: [] })],
    ['NOT FOUND status string', JSON.stringify({ status: 'NOT FOUND' })],
  ])('reports ERROR rather than NOT_FOUND: %s', async (_label, body) => {
    if (body !== null) {
      enableLiveMode();
      mockFetch(body);
    }

    const artifact = await new DcaBreezeAdapter().fetchArtifact(NPI);

    expect(artifact.status).not.toBe('NOT_FOUND');
    expect(artifact.status).toBe('ERROR');
  });
});

describe('DCA BreEZe adapter reports adverse board actions honestly', () => {
  it.each(['REVOKED', 'SURRENDERED'])('maps %s to EXPIRED and marks it adverse', async (status) => {
    enableLiveMode();
    mockFetch(JSON.stringify({ status, licenseNumber: 'A-2' }));

    const artifact = await new DcaBreezeAdapter().fetchArtifact(NPI);

    expect(artifact.status).toBe('EXPIRED');
    expect(artifact.normalizedData.adverseAction).toBe(true);
    expect(artifact.normalizedData.boardReportedStatus).toBe(status);
  });
});

describe('DCA BreEZe adapter omits absent fields rather than empty strings', () => {
  it('leaves expiresAt and licenseNumber undefined when the board reports neither', async () => {
    enableLiveMode();
    mockFetch(JSON.stringify({ status: 'ACTIVE' }));

    const artifact = await new DcaBreezeAdapter().fetchArtifact(NPI);

    expect(artifact.status).toBe('ACTIVE');
    expect(artifact.expiresAt).toBeUndefined();
    expect(artifact.licenseNumber).toBeUndefined();
  });
});
