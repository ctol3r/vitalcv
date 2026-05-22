import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = execSync('git rev-parse --show-toplevel', {
  encoding: 'utf8',
}).trim();

function read(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), 'utf8');
}

function readStripped(rel: string): string {
  const raw = read(rel);
  return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function runVerifier(args: string[]): { code: number; output: string } {
  try {
    const output = execSync(
      `node --experimental-strip-types scripts/verify-production-integrity.ts ${args.join(' ')}`,
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    return { code: 0, output };
  } catch (err) {
    const e = err as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string };
    const stdout =
      typeof e.stdout === 'string'
        ? e.stdout
        : Buffer.isBuffer(e.stdout)
          ? e.stdout.toString('utf8')
          : '';
    const stderr =
      typeof e.stderr === 'string'
        ? e.stderr
        : Buffer.isBuffer(e.stderr)
          ? e.stderr.toString('utf8')
          : '';
    return { code: e.status ?? 1, output: stdout + stderr };
  }
}

const VERIFIER_TIMEOUT_MS = 60_000;

// ── File presence ────────────────────────────────────────────────────────

describe('production-deployment-integrity · file presence', () => {
  it.each([
    'docs/ops/production-deployment-integrity.md',
    'scripts/verify-production-integrity.ts',
    'apps/web/components/intelligence/LiveFeedRibbon.tsx',
  ])('%s exists', (rel) => {
    expect(existsSync(resolve(REPO_ROOT, rel))).toBe(true);
  });
});

// ── LiveFeedRibbon cosmetic tick removal ─────────────────────────────────

describe('LiveFeedRibbon · no cosmetic ticker', () => {
  const stripped = readStripped('apps/web/components/intelligence/LiveFeedRibbon.tsx');

  it('does NOT contain the cosmetic refreshSeconds setInterval', () => {
    expect(stripped).not.toMatch(/setRefreshSeconds\(\(prev\) => prev \+ 1\)/);
  });

  it('does NOT render the cosmetic "00:NN" ticker', () => {
    expect(stripped).not.toMatch(/00:\{refreshSeconds/);
  });

  it('renders lastFetchedAt or "Awaiting first fetch"', () => {
    expect(stripped).toMatch(/lastFetchedAt/);
    expect(stripped).toMatch(/Awaiting first fetch/);
  });

  it('the real feed poll is preserved (no change to FEED_POLL_INTERVAL_MS usage)', () => {
    expect(stripped).toMatch(/FEED_POLL_INTERVAL_MS/);
  });
});

// ── Marketing surface normalizations ─────────────────────────────────────

describe('marketing surfaces · no Real-Time Monitoring overclaim', () => {
  it('BentoGrid uses per-request resolution language', () => {
    const src = read('apps/web/components/marketing/BentoGrid.tsx');
    expect(src).not.toMatch(/Real-Time Monitoring/);
    expect(src).toMatch(/Per-request federal-source resolution/);
    expect(src).toMatch(/No continuous monitoring is performed/);
  });

  it('HomeSections uses "resolve federal-source lanes on request"', () => {
    const src = read('apps/web/components/marketing/HomeSections.tsx');
    expect(src).not.toMatch(/working in real time/);
    expect(src).toMatch(/resolve federal-source lanes on request/);
  });
});

// ── Doctrine doc shape ───────────────────────────────────────────────────

describe('production-deployment-integrity doctrine', () => {
  const md = read('docs/ops/production-deployment-integrity.md');

  it('declares the three binding rules', () => {
    expect(md).toMatch(/R1 · No fake-activity indicators/);
    expect(md).toMatch(/R2 · No fake production \/ deployment confidence/);
    expect(md).toMatch(/R3 · Degraded states must render visibly/);
  });

  it('records the LiveFeedRibbon repair', () => {
    expect(md).toMatch(/LiveFeedRibbon\.tsx/);
    expect(md).toMatch(/ticking `00:NN` counter/);
    expect(md).toMatch(/`Last fetched HH:MM:SS`/);
  });

  it('records the marketing-surface repairs', () => {
    expect(md).toMatch(/BentoGrid\.tsx/);
    expect(md).toMatch(/HomeSections\.tsx/);
  });

  it('declares the banned production-confidence phrases', () => {
    expect(md).toMatch(/Real-Time Monitoring/);
    expect(md).toMatch(/99\.9%/);
    expect(md).toMatch(/five-nines/);
    expect(md).toMatch(/fault-tolerant/);
    expect(md).toMatch(/Always-on/);
  });

  it('declares the network_error / backend_unavailable runtime states', () => {
    expect(md).toMatch(/network_error/);
    expect(md).toMatch(/backend_unavailable/);
  });

  it('declares the no-new-features posture', () => {
    expect(md).toMatch(/does NOT modify nav exposure/i);
  });
});

// ── Verifier behavior ────────────────────────────────────────────────────

describe('verify-production-integrity script', () => {
  it(
    'enforce mode passes on the repaired state',
    () => {
      const r = runVerifier(['enforce']);
      expect(r.output).toContain('verify-production-integrity');
      expect(r.output).toMatch(/\[OK\s+\] production integrity: no FAIL drift/);
      expect(r.code).toBe(0);
    },
    VERIFIER_TIMEOUT_MS,
  );

  it(
    'deployment-state sub-mode reports canonical routes',
    () => {
      const r = runVerifier(['deployment-state']);
      expect(r.output).toContain('canonical route resolves: apps/web/app/page.tsx');
      expect(r.output).toContain('canonical route resolves: apps/web/app/passport/page.tsx');
      expect(r.output).toContain('canonical route resolves: apps/web/app/review/page.tsx');
      expect(r.output).toContain('canonical route resolves: apps/web/app/status/page.tsx');
      // /get-ready may or may not be present on this checkout
      expect(r.output).toMatch(/apps\/web\/app\/get-ready\/page\.tsx/);
    },
    VERIFIER_TIMEOUT_MS,
  );

  it(
    'runtime-recovery sub-mode emits a scan summary',
    () => {
      const r = runVerifier(['runtime-recovery']);
      expect(r.output).toMatch(/runtime-recovery scan: \d+ fetch-using file/);
      expect(r.output).toMatch(/expose Retry/);
      expect(r.output).toMatch(/cached\/stale banner/);
      expect(r.code).toBe(0);
    },
    VERIFIER_TIMEOUT_MS,
  );
});

// ── Pnpm registration ────────────────────────────────────────────────────

describe('package.json · production-integrity scripts', () => {
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

  it.each([
    'verify:production-integrity',
    'verify:deployment-state',
    'verify:runtime-recovery',
  ])('exposes pnpm %s', (key) => {
    expect(pkg.scripts[key]).toBeDefined();
    expect(pkg.scripts[key]).toMatch(/verify-production-integrity/);
  });
});
