/**
 * Regression tests for the fabricated-expiry defect.
 *
 * Until 2026-08-08 the scanner ignored `VerificationArtifact.expiresAt` and
 * computed `(verifiedAt ?? createdAt) + 365 days`, then served the result as
 * a CRITICAL "has expired" alert about a real named clinician on a public
 * endpoint. The first test here is the one that would have caught it: an
 * artifact two years old with NO published expiry must produce nothing.
 */
import { randomUUID } from 'crypto';
import prisma from '../../../graphql/prisma_client';
import { scanExpirations, scanExpirationsByNpi } from '../expirationScanner';
import { generateAlerts } from '../alertEngine';

const RUN = randomUUID().slice(0, 8);
const NPIS: string[] = [];
const ARTIFACT_IDS: string[] = [];

const NOW = new Date('2026-08-08T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function npiFor(): string {
  const npi = `7${String(NPIS.length + 1).padStart(4, '0')}${RUN.slice(0, 5)}`.slice(0, 10);
  NPIS.push(npi);
  return npi;
}

async function makeArtifact(input: {
  npi: string;
  expiresAt: Date | null;
  createdAt?: Date;
  status?: string;
}): Promise<string> {
  const id = randomUUID();
  await prisma.verificationArtifact.create({
    data: {
      id,
      npi: input.npi,
      source: 'STATE_BOARD',
      status: input.status ?? 'VERIFIED',
      checksum: `sha256:${randomUUID().replace(/-/g, '')}`,
      // Deliberately ancient: under the old code this alone produced an
      // "expired" alert.
      createdAt: input.createdAt ?? new Date('2024-01-01T00:00:00.000Z'),
      verifiedAt: input.createdAt ?? new Date('2024-01-01T00:00:00.000Z'),
      expiresAt: input.expiresAt,
    },
  });
  ARTIFACT_IDS.push(id);
  return id;
}

afterAll(async () => {
  await prisma.verificationArtifact.deleteMany({ where: { id: { in: ARTIFACT_IDS } } });
  await prisma.$disconnect();
});

describe('expirationScanner — no expiry means no finding', () => {
  it('emits NOTHING for an old artifact with no published expiry', async () => {
    // The regression. Two and a half years old, no expiry from the source.
    const npi = npiFor();
    await makeArtifact({ npi, expiresAt: null });

    const alerts = await scanExpirationsByNpi(npi, { now: NOW });
    expect(alerts).toEqual([]);
  });

  it('emits nothing for an artifact whose expiry is beyond the notice window', async () => {
    const npi = npiFor();
    await makeArtifact({ npi, expiresAt: new Date(NOW.getTime() + 200 * DAY) });
    expect(await scanExpirationsByNpi(npi, { now: NOW })).toEqual([]);
  });

  it('reports the SOURCE-published date, never a computed one', async () => {
    const npi = npiFor();
    const expiresAt = new Date(NOW.getTime() + 10 * DAY);
    await makeArtifact({ npi, expiresAt });

    const alerts = await scanExpirationsByNpi(npi, { now: NOW });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].expiresAt).toBe(expiresAt.toISOString());
    expect(alerts[0].daysRemaining).toBe(10);
    expect(alerts[0].severity).toBe('CRITICAL');
    // The old field name carried an invented number and must be gone.
    expect(alerts[0]).not.toHaveProperty('estimatedExpiry');
  });

  it('classifies the windows off the real date', async () => {
    const npi = npiFor();
    await makeArtifact({ npi, expiresAt: new Date(NOW.getTime() - 5 * DAY) });
    await makeArtifact({ npi, expiresAt: new Date(NOW.getTime() + 20 * DAY) });
    await makeArtifact({ npi, expiresAt: new Date(NOW.getTime() + 60 * DAY) });

    const alerts = await scanExpirationsByNpi(npi, { now: NOW });
    expect(alerts.map((a) => a.severity)).toEqual(['EXPIRED', 'CRITICAL', 'WARNING']);
    // Ordered most urgent first, straight from the query.
    expect(alerts[0].daysRemaining).toBeLessThan(alerts[1].daysRemaining);
  });

  it('ignores revoked and suspended artifacts', async () => {
    const npi = npiFor();
    await makeArtifact({ npi, expiresAt: new Date(NOW.getTime() + 5 * DAY), status: 'REVOKED' });
    await makeArtifact({ npi, expiresAt: new Date(NOW.getTime() + 5 * DAY), status: 'SUSPENDED' });
    expect(await scanExpirationsByNpi(npi, { now: NOW })).toEqual([]);
  });

  it('scopes by NPI in the query rather than scanning the whole table', async () => {
    const mine = npiFor();
    const theirs = npiFor();
    await makeArtifact({ npi: mine, expiresAt: new Date(NOW.getTime() + 5 * DAY) });
    await makeArtifact({ npi: theirs, expiresAt: new Date(NOW.getTime() + 5 * DAY) });

    const alerts = await scanExpirationsByNpi(mine, { now: NOW });
    expect(alerts.every((a) => a.npi === mine)).toBe(true);
    expect(alerts).toHaveLength(1);
  });

  it('a broad scan still excludes every no-expiry artifact', async () => {
    const npi = npiFor();
    await makeArtifact({ npi, expiresAt: null });
    const all = await scanExpirations({ now: NOW });
    expect(all.some((a) => a.npi === npi)).toBe(false);
    // Nothing in a scan may carry a missing or invented date.
    expect(all.every((a) => typeof a.expiresAt === 'string' && a.expiresAt.length > 0)).toBe(true);
  });
});

describe('alertEngine copy states its provenance', () => {
  it('names the source-published date in the description', async () => {
    const npi = npiFor();
    const expiresAt = new Date(NOW.getTime() + 3 * DAY);
    await makeArtifact({ npi, expiresAt });

    const alerts = await generateAlerts();
    const mine = alerts.filter((a) => a.npi === npi);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine[0].description).toContain('published an expiry of');
    expect(mine[0].description).toContain(expiresAt.toISOString().slice(0, 10));
  });
});
