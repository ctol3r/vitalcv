import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PSVDecision, PSVSource, PSVStatus } from '../psvContracts';

const FIXED_DATE = new Date('2025-02-01T12:00:00.000Z');

const expectedExpiry = (days: number) =>
  new Date(FIXED_DATE.getTime() + days * 86400000).toISOString();

const loadDemo = async (samApiKey?: string) => {
  if (samApiKey) {
    process.env.SAM_API_KEY = samApiKey;
  } else {
    delete process.env.SAM_API_KEY;
  }

  vi.resetModules();
  return import('../../../apps/web/lib/psv-integrations');
};

describe('PSV demo integration output', () => {
  const originalSamApiKey = process.env.SAM_API_KEY;

  beforeEach(() => {
    delete process.env.SAM_API_KEY;
  });

  afterEach(() => {
    if (originalSamApiKey) {
      process.env.SAM_API_KEY = originalSamApiKey;
    } else {
      delete process.env.SAM_API_KEY;
    }
    vi.resetModules();
  });

  it('builds deterministic demo checks without SAM credentials', async () => {
    const { runPsvDemo } = await loadDemo();
    const report = runPsvDemo('1234567890', FIXED_DATE);

    expect(report.decision).toBe(PSVDecision.REVIEW);
    expect(report.checks.map((check) => check.source)).toEqual([
      PSVSource.OIG_LEIE,
      PSVSource.SAM_EXCLUSIONS,
      PSVSource.CMS_PPEF,
      PSVSource.STATE_BOARD,
      PSVSource.DEA,
      PSVSource.NPDB,
    ]);

    const oig = report.checks[0];
    expect(oig.status).toBe(PSVStatus.PASS);
    expect(oig.evidence.checkedAt).toBe(FIXED_DATE.toISOString());
    expect(oig.evidence.expiresAt).toBe(expectedExpiry(30));

    const sam = report.checks[1];
    expect(sam.status).toBe(PSVStatus.UNKNOWN);
    expect(report.reasons).toEqual([
      'UNKNOWN: SAM_EXCLUSIONS check returned unknown status',
      'UNKNOWN: STATE_BOARD check returned unknown status',
      'UNKNOWN: DEA check returned unknown status',
      'UNKNOWN: NPDB check returned unknown status',
    ]);
  });

  it('marks SAM as PASS when credentials exist', async () => {
    const { runPsvDemo } = await loadDemo('demo-key');
    const report = runPsvDemo('9876543210', FIXED_DATE);

    const sam = report.checks.find((check) => check.source === PSVSource.SAM_EXCLUSIONS);
    expect(sam?.status).toBe(PSVStatus.PASS);
    expect(report.reasons).toEqual([
      'UNKNOWN: STATE_BOARD check returned unknown status',
      'UNKNOWN: DEA check returned unknown status',
      'UNKNOWN: NPDB check returned unknown status',
    ]);
  });
});
