/**
 * openevidence-demo-spine.test.ts
 *
 * Per TASK 8: verifies that the demo-spine routes render, the ROI math
 * is correct, no banned phrases appear in the new files, no bare
 * "Verified" labels are present, all synthetic demo data is labeled
 * illustrative/demo, and the founder/demo scripts reference the
 * correct repo path.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CBP_CREDENTIALING_DAYS,
  DAILY_DELAY_COST_HIGH,
  DAILY_DELAY_COST_LOW,
  DAYS_SAVED,
  RESEARCH_SIGNALS,
  SINGLE_PHYSICIAN_DELAY_COST_HIGH,
  SINGLE_PHYSICIAN_DELAY_COST_LOW,
  SPECIALTY_OPTIONS,
  TRADITIONAL_CREDENTIALING_DAYS,
  computeRoiRange,
  formatUsdCompact,
} from '../app/demo/_marketData';
import { DEMO_PERSONAS, DEMO_EMPLOYER_APPLICATIONS, DEMO_ISSUER_REQUESTS } from '../app/demo/_seed';

// ── Helpers ────────────────────────────────────────────────────────────────

const BANNED_PHRASES = [
  /automatically verified/i,
  /guaranteed verification/i,
  /\bcomplete credentialing\b/i,
  /instant credentialing/i,
  /legally accepted/i,
  /risk transferred/i,
  /HIPAA compliant/i,
  /SOC2 certified/i,
  /certified compliant/i,
  /NCQA certified/i,
  /final verification without review/i,
  /source confirmed before response/i,
];

const REPO_ROOT = join(__dirname, '../..', '..');

function readRepoFile(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

// ── ROI math ───────────────────────────────────────────────────────────────

describe('marketData — ROI math', () => {
  it('TRADITIONAL_CREDENTIALING_DAYS - CBP_CREDENTIALING_DAYS = DAYS_SAVED (103 - 36 = 67)', () => {
    expect(TRADITIONAL_CREDENTIALING_DAYS).toBe(103);
    expect(CBP_CREDENTIALING_DAYS).toBe(36);
    expect(DAYS_SAVED).toBe(67);
    expect(TRADITIONAL_CREDENTIALING_DAYS - CBP_CREDENTIALING_DAYS).toBe(DAYS_SAVED);
  });

  it('daily delay cost bounds match the published benchmark range', () => {
    expect(DAILY_DELAY_COST_LOW).toBe(2700);
    expect(DAILY_DELAY_COST_HIGH).toBe(5400);
  });

  it('single-physician 67-day exposure = $180,900–$361,800', () => {
    expect(DAYS_SAVED * DAILY_DELAY_COST_LOW).toBe(180_900);
    expect(DAYS_SAVED * DAILY_DELAY_COST_HIGH).toBe(361_800);
    expect(SINGLE_PHYSICIAN_DELAY_COST_LOW).toBe(180_900);
    expect(SINGLE_PHYSICIAN_DELAY_COST_HIGH).toBe(361_800);
  });

  it('computeRoiRange scales linearly with provider count', () => {
    expect(computeRoiRange({ providerCount: 1 })).toEqual({ totalLow: 180_900, totalHigh: 361_800 });
    expect(computeRoiRange({ providerCount: 5 })).toEqual({ totalLow: 904_500, totalHigh: 1_809_000 });
    expect(computeRoiRange({ providerCount: 10 })).toEqual({ totalLow: 1_809_000, totalHigh: 3_618_000 });
    expect(computeRoiRange({ providerCount: 25 })).toEqual({ totalLow: 4_522_500, totalHigh: 9_045_000 });
  });

  it('formatUsdCompact produces compact $k / $M strings', () => {
    expect(formatUsdCompact(900)).toBe('$900');
    expect(formatUsdCompact(180_900)).toBe('$181k');
    expect(formatUsdCompact(1_809_000)).toMatch(/^\$1\.81M$/);
  });

  it('exposes all 10 specialty / persona options for the calculator', () => {
    expect(SPECIALTY_OPTIONS).toHaveLength(10);
    // Per PHASE 5 spec — persona-style options that mix setting + role:
    expect(SPECIALTY_OPTIONS).toContain('rural_fqhc');
    expect(SPECIALTY_OPTIONS).toContain('locum_tenens_hospitalist');
    expect(SPECIALTY_OPTIONS).toContain('multi_state_np');
  });
});

// ── Route renderability ────────────────────────────────────────────────────

describe('demo spine — pages render', () => {
  async function renderPage(modulePath: string): Promise<string> {
    const mod = await import(modulePath);
    const Page = mod.default;
    return renderToStaticMarkup(Page());
  }

  it('/launch renders and contains the primary message', async () => {
    const html = await renderPage('../app/launch/page');
    expect(html).toContain('Reusable, source-backed clinician readiness');
    expect(html).toContain('See the employer view');
  });

  it('/demo renders and links to all three sub-flows', async () => {
    const html = await renderPage('../app/demo/page');
    expect(html).toContain('/demo/clinician');
    expect(html).toContain('/demo/employer');
    expect(html).toContain('/demo/issuer');
  });

  it('/demo/clinician renders all 6 personas', async () => {
    const html = await renderPage('../app/demo/clinician/page');
    for (const p of DEMO_PERSONAS) {
      expect(html).toContain(p.displayName);
    }
  });

  it('/demo/employer renders all 3 employer applications', async () => {
    const html = await renderPage('../app/demo/employer/page');
    for (const a of DEMO_EMPLOYER_APPLICATIONS) {
      expect(html).toContain(a.candidate.displayName);
    }
  });

  it('/demo/issuer renders all 3 issuer requests', async () => {
    const html = await renderPage('../app/demo/issuer/page');
    for (const r of DEMO_ISSUER_REQUESTS) {
      expect(html).toContain(r.requestId);
    }
  });
});

// ── Truth contract: banned phrases ─────────────────────────────────────────

describe('truth contract — banned phrases', () => {
  const newFiles = [
    'apps/web/app/launch/page.tsx',
    'apps/web/app/demo/page.tsx',
    'apps/web/app/demo/_seed.ts',
    'apps/web/app/demo/_marketData.ts',
    'apps/web/app/demo/clinician/page.tsx',
    'apps/web/app/demo/employer/page.tsx',
    'apps/web/app/demo/issuer/page.tsx',
    'apps/web/components/demo/RoiCalculator.tsx',
    'apps/web/components/demo/EquityRetentionBlock.tsx',
  ];

  for (const f of newFiles) {
    it(`${f} contains no banned phrases`, () => {
      const src = readRepoFile(f);
      for (const re of BANNED_PHRASES) {
        expect(src, `${f} contains banned phrase ${re}`).not.toMatch(re);
      }
    });
  }
});

// ── Truth contract: no bare "Verified" labels ──────────────────────────────

describe('truth contract — no bare Verified labels', () => {
  const newFiles = [
    'apps/web/app/launch/page.tsx',
    'apps/web/app/demo/page.tsx',
    'apps/web/app/demo/clinician/page.tsx',
    'apps/web/app/demo/employer/page.tsx',
    'apps/web/app/demo/issuer/page.tsx',
    'apps/web/components/demo/RoiCalculator.tsx',
    'apps/web/components/demo/EquityRetentionBlock.tsx',
  ];
  // Bare-Verified violation patterns:
  //   - label="Verified" / label='Verified'
  //   - >Verified</  (rendered between tags)
  const BARE_VERIFIED = [
    /label\s*[:=]\s*["']Verified["']/,
    />\s*Verified\s*</,
  ];

  for (const f of newFiles) {
    it(`${f} contains no bare-Verified label`, () => {
      const src = readRepoFile(f);
      for (const re of BARE_VERIFIED) {
        expect(src, `${f} matches bare-Verified pattern ${re}`).not.toMatch(re);
      }
    });
  }
});

// ── Synthetic demo data labeled ───────────────────────────────────────────

describe('truth contract — synthetic demo data labeled illustrative', () => {
  it('every DEMO_PERSONAS entry has isSyntheticNpi: true', () => {
    for (const p of DEMO_PERSONAS) {
      expect(p.isSyntheticNpi).toBe(true);
    }
  });

  it('every persona displayName carries a "DEMO" marker', () => {
    for (const p of DEMO_PERSONAS) {
      expect(p.displayName).toMatch(/\bDEMO\b/i);
    }
  });

  it('every employer-application organization carries a "DEMO" marker', () => {
    for (const a of DEMO_EMPLOYER_APPLICATIONS) {
      expect(a.organization).toMatch(/\bDEMO\b/i);
    }
  });

  it('every issuer-request issuerOrg or claimSummary carries a "DEMO" marker', () => {
    for (const r of DEMO_ISSUER_REQUESTS) {
      const combined = `${r.issuerOrg} ${r.claimSummary}`;
      expect(combined).toMatch(/\bDEMO\b/i);
    }
  });
});

// ── Research signal posture (no overclaim) ─────────────────────────────────

describe('research signals — posture', () => {
  it('every research signal has a citation hint', () => {
    for (const key of Object.keys(RESEARCH_SIGNALS) as Array<keyof typeof RESEARCH_SIGNALS>) {
      const s = RESEARCH_SIGNALS[key];
      expect(s.cite, `${key} missing cite`).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.value).toBeTruthy();
      expect(s.context).toBeTruthy();
    }
  });
});

// ── Script paths ──────────────────────────────────────────────────────────

describe('scripts — repo-path references', () => {
  const scripts = ['scripts/public-demo.sh', 'scripts/founder-mode.sh'];
  for (const s of scripts) {
    it(`${s} does not reference the stale ~/vitalcv-omega4f-trigger path`, () => {
      const src = readRepoFile(s);
      expect(src, `${s} contains stale omega path`).not.toContain('vitalcv-omega4f-trigger');
    });
  }
});
