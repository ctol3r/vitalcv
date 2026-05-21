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

/**
 * Some repaired files carry a JSDoc-block at the top that explains
 * what was changed and includes the original banned phrases for
 * context. Negative assertions about banned-phrase removal should
 * strip those comments first so the explanatory text doesn't
 * masquerade as a regression.
 */
function readStripped(rel: string): string {
  const raw = readFileSync(resolve(REPO_ROOT, rel), 'utf8');
  return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function runVerifier(args: string[]): { code: number; output: string } {
  try {
    const output = execSync(
      `node --experimental-strip-types scripts/verify-p0-p1-institutional-hardening.ts ${args.join(' ')}`,
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

describe('p0-p1-institutional-hardening · file presence', () => {
  it.each([
    'docs/product/p0-p1-institutional-hardening.md',
    'scripts/verify-p0-p1-institutional-hardening.ts',
  ])('%s exists', (rel) => {
    expect(existsSync(resolve(REPO_ROOT, rel))).toBe(true);
  });
});

// ── P0 repairs ───────────────────────────────────────────────────────────

describe('P0 · ClearToStartBanner', () => {
  const src = read('apps/web/components/trust-state/ClearToStartBanner.tsx');
  const stripped = readStripped('apps/web/components/trust-state/ClearToStartBanner.tsx');

  it('removes the unsafe "verified and continuously monitored" copy', () => {
    expect(stripped).not.toMatch(/All mandatory requirements verified and continuously monitored/);
  });

  it('uses lane-evidence + institution-review framing', () => {
    expect(src).toMatch(/Lane evidence completed/);
    expect(src).toMatch(/Federal-source lanes were source-confirmed/);
    expect(src).toMatch(/Institution review is still required/);
  });

  it('explicitly disavows continuous monitoring', () => {
    expect(src).toMatch(/does not perform\s+continuous\s+monitoring/);
  });

  it('exports a data-slot for verifier integration', () => {
    expect(src).toMatch(/data-slot="clear-to-start-banner"/);
  });
});

describe('P0 · ConsoleWrapper proceed semantics', () => {
  const src = read('apps/web/app/review/[entityId]/ConsoleWrapper.tsx');

  it('removes "Credentials verified. Clear to proceed."', () => {
    expect(src).not.toMatch(/Credentials verified\.\s*Clear to proceed\./);
  });

  it('every posture branch names institution review explicitly', () => {
    const fn = src.slice(src.indexOf('function deriveNextAction'));
    const blockedBranch = fn.match(/posture === 'blocked'[^\n]*\n[^}]+/)?.[0] ?? '';
    const decisionGradeBranch = fn.match(/posture === 'decision_grade'[^\n]*\n[^}]+/)?.[0] ?? '';
    expect(blockedBranch).toMatch(/Institution review required/i);
    expect(decisionGradeBranch).toMatch(/Institution review still required/i);
    expect(fn).toMatch(/institution review still required/i);
  });

  it('no proceed-by-default copy in the default branch', () => {
    expect(src).not.toMatch(/You can proceed with a head start\./);
  });
});

// ── P1 repairs ───────────────────────────────────────────────────────────

describe('P1 · MonitoringStatusBadge', () => {
  const src = read('apps/web/components/trust-state/MonitoringStatusBadge.tsx');
  const stripped = readStripped('apps/web/components/trust-state/MonitoringStatusBadge.tsx');

  it('removes "Continuously Monitored" / "Monitoring Inactive" labels', () => {
    expect(stripped).not.toMatch(/['"]Continuously Monitored['"]/);
    expect(stripped).not.toMatch(/['"]Monitoring Inactive['"]/);
  });

  it('uses "Re-checked on request" / "Per-request re-checks disabled"', () => {
    expect(src).toMatch(/Re-checked on request/);
    expect(src).toMatch(/Per-request re-checks disabled/);
  });

  it('tooltip disavows continuous monitoring', () => {
    expect(stripped).not.toMatch(/automatically monitored/);
    expect(src).toMatch(/No continuous monitoring is performed/);
  });
});

describe('P1 · ApplyBundleView monitoring labels', () => {
  const src = read('apps/web/components/apply/ApplyBundleView.tsx');

  it('removes "Continuously monitored" / "Monitoring inactive"', () => {
    expect(src).not.toMatch(/['"]Continuously monitored['"]/);
    expect(src).not.toMatch(/['"]Monitoring inactive['"]/);
  });

  it('uses bounded labels', () => {
    expect(src).toMatch(/['"]Re-checked on request['"]/);
    expect(src).toMatch(/['"]Per-request re-checks disabled['"]/);
  });
});

describe('P1 · TrustStateCard window labels', () => {
  const src = read('apps/web/components/trust-state/TrustStateCard.tsx');

  it('removes "Continuously Monitored" from WINDOW_LABEL', () => {
    expect(src).not.toMatch(/WITHIN_WINDOW:\s*['"]Continuously Monitored['"]/);
  });

  it('uses institution-freshness-budget framing', () => {
    expect(src).toMatch(/Within institution freshness budget/);
    expect(src).toMatch(/Freshness budget expiring soon/);
    expect(src).toMatch(/Stale — re-fetch required/);
  });
});

describe('P1 · verifier-types.ts recognition + decay copy', () => {
  const src = read('apps/web/components/employer/verifier-types.ts');

  it('removes "PSV-backed recognition"', () => {
    expect(src).not.toMatch(/PSV-backed recognition/);
  });

  it('removes "automatic decay" language', () => {
    expect(src).not.toMatch(/triggering automatic decay/);
    expect(src).not.toMatch(/automatically decay/);
  });

  it('uses source-confirmed lane-evidence framing', () => {
    expect(src).toMatch(/Source-confirmed lane evidence is on record/);
    expect(src).toMatch(/institution.+freshness budget/i);
  });

  it('replaces "safety threshold" with institution-owned review threshold', () => {
    expect(src).not.toMatch(/safety threshold/);
    expect(src).toMatch(/institution.+own review threshold/i);
  });
});

describe('P1 · DisclosureScopePanel cryptographic copy', () => {
  const src = read('apps/web/components/trust-state/DisclosureScopePanel.tsx');

  it('removes "cryptographically scoped"', () => {
    expect(src).not.toMatch(/cryptographically scoped/);
  });

  it('removes "automatically decay"', () => {
    expect(src).not.toMatch(/automatically decay/);
  });

  it('uses signature-scoped + re-presentation framing', () => {
    expect(src).toMatch(/signature-scoped/);
    expect(src).toMatch(/must be re-presented/);
  });
});

// ── Doctrine doc shape ───────────────────────────────────────────────────

describe('p0-p1 hardening doctrine doc', () => {
  const md = read('docs/product/p0-p1-institutional-hardening.md');

  it('records the P0 repairs by id', () => {
    expect(md).toMatch(/P0-1 · ClearToStartBanner/);
    expect(md).toMatch(/P0-2 · ConsoleWrapper proceed semantics/);
  });

  it('records the P1 repairs by id', () => {
    for (const id of [
      'P1-1 · MonitoringStatusBadge',
      'P1-2 · ApplyBundleView',
      'P1-3 · TrustStateCard',
      'P1-4 · verifier-types',
      'P1-5 · DisclosureScopePanel',
    ]) {
      expect(md).toContain(id);
    }
  });

  it('enumerates the four degraded states that must be visible', () => {
    for (const s of ['access_required', 'source_unavailable', 'timeout', 'incomplete_evidence']) {
      expect(md).toContain(s);
    }
  });

  it('declares the no-new-features posture', () => {
    expect(md).toMatch(/Does NOT add any new feature/i);
    expect(md).toMatch(/Does NOT touch API route source code/i);
  });
});

// ── Verifier behavior ────────────────────────────────────────────────────

describe('verify-p0-p1-institutional-hardening script', () => {
  it(
    'enforce mode passes after the repairs (no FAIL drift)',
    () => {
      const r = runVerifier(['enforce']);
      expect(r.output).toContain('verify-p0-p1-institutional-hardening');
      expect(r.output).toMatch(/\[OK\s+\] p0-p1 institutional hardening: no FAIL drift/);
      expect(r.code).toBe(0);
    },
    VERIFIER_TIMEOUT_MS,
  );

  it(
    'report sub-mode never exits non-zero',
    () => {
      const r = runVerifier(['report']);
      expect(r.code).toBe(0);
    },
    VERIFIER_TIMEOUT_MS,
  );

  it(
    'degraded-states-only emits a scan summary',
    () => {
      const r = runVerifier(['degraded-states-only']);
      expect(r.code).toBe(0);
      expect(r.output).toMatch(/degraded-states scan: \d+ verification-related file/);
    },
    VERIFIER_TIMEOUT_MS,
  );
});

// ── Pnpm registration ────────────────────────────────────────────────────

describe('package.json · p0-p1 scripts', () => {
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

  it.each([
    'verify:p0-p1-institutional-hardening',
    'verify:p0-p1-institutional-hardening-report',
    'verify:p0-p1-degraded-states',
  ])('exposes pnpm %s', (key) => {
    expect(pkg.scripts[key]).toBeDefined();
    expect(pkg.scripts[key]).toMatch(/verify-p0-p1-institutional-hardening/);
  });
});
