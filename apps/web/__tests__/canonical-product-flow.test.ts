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

function runVerifier(args: string[]): { code: number; output: string } {
  try {
    const output = execSync(
      `node --experimental-strip-types scripts/verify-canonical-flow.ts ${args.join(' ')}`,
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

const VERIFIER_TIMEOUT_MS = 30_000;

// ── File presence ────────────────────────────────────────────────────────

describe('canonical-product-flow · file presence', () => {
  it.each([
    'apps/web/app/get-ready/page.tsx',
    'apps/web/app/page.tsx',
    'apps/web/app/passport/page.tsx',
    'apps/web/app/review/page.tsx',
    'apps/web/app/status/page.tsx',
    'apps/web/components/layout/Navbar.tsx',
    'docs/product/canonical-product-flow.md',
    'scripts/verify-canonical-flow.ts',
  ])('%s exists', (rel) => {
    expect(existsSync(resolve(REPO_ROOT, rel))).toBe(true);
  });
});

// ── Get Ready landing shape ──────────────────────────────────────────────

describe('/get-ready landing', () => {
  const src = read('apps/web/app/get-ready/page.tsx');

  it('carries the canonical Step 1 framing', () => {
    expect(src).toMatch(/Step 1 of the canonical flow/i);
    expect(src).toMatch(/Get ready/i);
  });

  it('contains exactly one primary action linking to /passport', () => {
    const matches = src.match(/href="\/passport"/g) ?? [];
    expect(matches.length).toBe(1);
    expect(src).toMatch(/Continue to your passport/i);
  });

  it('declares the institution-owned boundary explicitly', () => {
    expect(src).toMatch(/institution-owned/i);
    expect(src).toMatch(/State medical board/i);
    expect(src).toMatch(/Credentialing committee/i);
    expect(src).toMatch(/Privileging/i);
  });

  it('does not write to any backend (no fetch/POST)', () => {
    expect(src).not.toMatch(/\bfetch\(/);
    expect(src).not.toMatch(/method:\s*['"]POST['"]/);
  });
});

// ── Navbar shape ─────────────────────────────────────────────────────────

describe('Navbar canonical shape', () => {
  const src = read('apps/web/components/layout/Navbar.tsx');

  it('exposes exactly five NAV_ITEMS entries in canonical order', () => {
    const m = src.match(/const\s+NAV_ITEMS\s*=\s*\[([\s\S]*?)\]\s*as\s+const/);
    expect(m).not.toBeNull();
    const body = m![1];
    const items: Array<{ href: string; label: string }> = [];
    const re = /\{\s*href:\s*['"]([^'"]+)['"]\s*,\s*label:\s*['"]([^'"]+)['"]\s*\}/g;
    for (const it of body.matchAll(re)) {
      items.push({ href: it[1], label: it[2] });
    }
    expect(items.length).toBe(5);
    expect(items).toEqual([
      { href: '/', label: 'Home' },
      { href: '/get-ready', label: 'Get Ready' },
      { href: '/passport', label: 'Passport' },
      { href: '/review', label: 'Review' },
      { href: '/status', label: 'Status' },
    ]);
  });

  it('does NOT expose fragmented topology in NAV_ITEMS', () => {
    const m = src.match(/const\s+NAV_ITEMS\s*=\s*\[([\s\S]*?)\]\s*as\s+const/);
    const body = m![1];
    for (const forbidden of [
      '/trust',
      '/doctrine',
      '/investigate',
      '/autopilot',
      '/inbox',
      '/dossier',
      '/graph',
      '/findings',
      '/issuer',
      '/calibration',
      '/system-health',
      '/mission-ops',
      '/intelligence',
    ]) {
      expect(body).not.toContain(`href: '${forbidden}'`);
      expect(body).not.toContain(`href: "${forbidden}"`);
    }
  });
});

// ── Audit doc shape ──────────────────────────────────────────────────────

describe('canonical-product-flow audit doc', () => {
  const md = read('docs/product/canonical-product-flow.md');

  it('declares the five canonical steps', () => {
    for (const step of ['Home', 'Get Ready', 'Passport', 'Review', 'Status']) {
      expect(md).toContain(step);
    }
  });

  it('declares the one-way canonical continuity progression', () => {
    expect(md).toMatch(/\/get-ready/);
    expect(md).toMatch(/\/passport/);
    expect(md).toMatch(/\/review/);
    expect(md).toMatch(/\/verify/);
    expect(md).toMatch(/\/status/);
    expect(md).toMatch(/progression is one-way/i);
  });

  it('declares the four continuity properties', () => {
    expect(md).toMatch(/confirm completion/i);
    expect(md).toMatch(/show next step/i);
    expect(md).toMatch(/identify ownership/i);
    expect(md).toMatch(/disclose simulation boundaries/i);
  });

  it('lists hidden/secondary route categories', () => {
    expect(md).toMatch(/\/trust\/\*/);
    expect(md).toMatch(/\/doctrine/);
    expect(md).toMatch(/\/investigate\/\*/);
    expect(md).toMatch(/\/autopilot/);
    expect(md).toMatch(/\/inbox/);
    expect(md).toMatch(/\/dossier\/\*/);
    expect(md).toMatch(/operator-only/i);
  });

  it('declares the no-deletion posture', () => {
    expect(md).toMatch(/Does NOT delete any route/i);
    expect(md).toMatch(/remains? reachable by/i);
  });
});

// ── Verifier behavior ────────────────────────────────────────────────────

describe('verify-canonical-flow script', () => {
  it(
    'full mode passes on a canonical state',
    () => {
      const r = runVerifier(['full']);
      expect(r.output).toContain('verify-canonical-flow');
      expect(r.output).toMatch(/\[OK\s+\] canonical flow: no drift detected/);
      expect(r.code).toBe(0);
    },
    VERIFIER_TIMEOUT_MS,
  );

  it(
    'nav-shape sub-mode reports each canonical item',
    () => {
      const r = runVerifier(['nav-shape']);
      for (const item of ['Home', 'Get Ready', 'Passport', 'Review', 'Status']) {
        expect(r.output).toContain(item);
      }
    },
    VERIFIER_TIMEOUT_MS,
  );

  it(
    'canonical-routes sub-mode reports each route',
    () => {
      const r = runVerifier(['canonical-routes']);
      for (const rel of [
        'apps/web/app/page.tsx',
        'apps/web/app/get-ready/page.tsx',
        'apps/web/app/passport/page.tsx',
        'apps/web/app/review/page.tsx',
        'apps/web/app/status/page.tsx',
      ]) {
        expect(r.output).toContain(rel);
      }
    },
    VERIFIER_TIMEOUT_MS,
  );
});

// ── Pnpm registration ────────────────────────────────────────────────────

describe('package.json · canonical-flow scripts', () => {
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

  it.each([
    'verify:canonical-flow',
    'verify:nav-shape',
    'verify:canonical-routes',
  ])('exposes pnpm %s', (key) => {
    expect(pkg.scripts[key]).toBeDefined();
    expect(pkg.scripts[key]).toMatch(/verify-canonical-flow/);
  });
});

// ── Truth contract ───────────────────────────────────────────────────────

describe('truth contract · canonical-flow surface', () => {
  const TOUCHED_FILES = [
    'apps/web/app/get-ready/page.tsx',
    'apps/web/components/layout/Navbar.tsx',
    'scripts/verify-canonical-flow.ts',
  ];

  const BANNED = [
    'magical onboarding',
    'instant verification',
    'automatically verified',
    'auto-approves',
    'ai-powered',
    'fully automated',
    'fake-product',
    'startup spectacle',
    'enterprise-grade',
  ];

  it.each(TOUCHED_FILES)('%s avoids banned jargon', (rel) => {
    const src = read(rel).toLowerCase();
    for (const phrase of BANNED) {
      expect(src.includes(phrase), `should not contain "${phrase}"`).toBe(false);
    }
  });

  it('audit doc declares the no-new-features posture', () => {
    const md = read('docs/product/canonical-product-flow.md');
    expect(md).toMatch(/Does NOT add new features/i);
  });
});
