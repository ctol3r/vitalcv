import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { EvidenceCapsuleError, EvidenceCapsuleResolved } from '@/components/home/evidence/EvidenceCapsule';
import {
  buildEvidenceCapsule,
  provenanceParts,
  registryIdentity,
  rowsOfKind,
  type Bootstrap,
} from '@/components/home/evidence/evidenceCapsuleModel';
import type { TrustState } from '@/components/readiness/sourceCheckNarration';
import { SOURCE_LANE_OPS } from '@/lib/trust/sourceLanes';

/**
 * Wave 3 — the resolved lookup.
 *
 * These are truth pins. Do not relax one to make a payload change pass: the
 * thing being guarded is what the homepage is allowed to claim about a real
 * provider from two source payloads.
 */

const NPI = '1234567893';

const REGISTRY_BOOT: Bootstrap = {
  firstName: 'AVERY',
  lastName: 'TESTPROVIDER',
  specialty: 'Family Medicine',
  state: 'CA',
  identitySource: 'NPPES_API',
};

/** The legacy shape: no provenance label AND already registered. */
const LEGACY_BOOT: Bootstrap = {
  firstName: 'Sarah',
  lastName: 'Chen',
  specialty: 'Cardiology',
  state: 'NY',
  alreadyRegistered: true,
};

const FULL_TRUST: TrustState = {
  identityVerified: true,
  exclusionStatus: 'CLEAR',
  pecosStatus: 'NOT_FOUND',
  licensureStatus: 'unknown',
  blockers: [],
  nextActions: [],
};

const build = (boot: Bootstrap | null, trust: TrustState | null) =>
  buildEvidenceCapsule(NPI, boot, trust);

const renderResolved = (boot: Bootstrap | null, trust: TrustState | null) =>
  renderToStaticMarkup(
    React.createElement(EvidenceCapsuleResolved, {
      model: build(boot, trust),
      onReset: () => undefined,
    }),
  );

describe('evidence capsule — grouping honesty', () => {
  it('does not file a monthly snapshot under a same-day heading', () => {
    const html = renderResolved(REGISTRY_BOOT, FULL_TRUST);
    // The regression this whole wave exists for: an OIG row whose own detail
    // says "monthly snapshot", sitting under a heading that says "Confirmed
    // today". HHS publishes the LEIE monthly, so a same-day exclusion cannot
    // be in the file the lane reads.
    expect(html).not.toMatch(/confirmed today/i);
    expect(html).toContain('Returned by source');
  });

  it('gives every group a label no stronger than its weakest row', () => {
    const html = renderResolved(REGISTRY_BOOT, FULL_TRUST).toLowerCase();
    for (const overclaim of [
      'confirmed today',
      'verified today',
      'all clear',
      'fully verified',
      'up to date',
      'current as of',
    ]) {
      expect(html).not.toContain(overclaim);
    }
  });

  it('renders each lane at the cadence the registry declares, never a typed one', () => {
    const model = build(REGISTRY_BOOT, FULL_TRUST);
    const cadence = (id: string) =>
      SOURCE_LANE_OPS.find((l) => l.laneId === id)!.cadenceLabel;

    expect(model.rows.find((r) => r.id === 'oig')!.cadence).toBe(cadence('oig_exclusions'));
    expect(model.rows.find((r) => r.id === 'pecos')!.cadence).toBe(cadence('pecos_enrollment'));
    expect(model.rows.find((r) => r.id === 'identity')!.cadence).toBe(cadence('nppes_identity'));
    expect(model.rows.find((r) => r.id === 'licensure')!.cadence).toBe(cadence('state_license'));
  });

  it('never labels PECOS or licensure as confirmed', () => {
    const model = build(REGISTRY_BOOT, FULL_TRUST);
    expect(model.rows.find((r) => r.id === 'pecos')!.kind).toBe('attention');
    expect(model.rows.find((r) => r.id === 'licensure')!.kind).toBe('unavailable');
  });
});

describe('evidence capsule — fixtures', () => {
  it('OIG clear returns a source response carrying its cadence and its limit', () => {
    const row = build(REGISTRY_BOOT, FULL_TRUST).rows.find((r) => r.id === 'oig')!;
    expect(row.kind).toBe('returned');
    expect(row.returned).toBe('No match in the current LEIE file');
    expect(row.cadence).toBe('monthly snapshot');
    expect(row.limitation).toMatch(/monthly file cannot show/i);
  });

  it('OIG excluded is attention, and does not assert the person is excluded', () => {
    const row = build(REGISTRY_BOOT, { ...FULL_TRUST, exclusionStatus: 'EXCLUDED' }).rows.find(
      (r) => r.id === 'oig',
    )!;
    expect(row.kind).toBe('attention');
    // A name+NPI match is a match, not a finding about the person.
    expect(row.returned).toMatch(/match was returned/i);
    expect(row.limitation).toMatch(/confirm against the source record/i);
  });

  it('OIG unchecked is unavailable, never an implied pass', () => {
    const row = build(REGISTRY_BOOT, { ...FULL_TRUST, exclusionStatus: 'UNCHECKED' }).rows.find(
      (r) => r.id === 'oig',
    )!;
    expect(row.kind).toBe('unavailable');
    expect(row.returned).toBe('Check not yet run');
  });

  it('PECOS not found is attention', () => {
    const row = build(REGISTRY_BOOT, FULL_TRUST).rows.find((r) => r.id === 'pecos')!;
    expect(row.kind).toBe('attention');
    expect(row.returned).toBe('No active enrollment found');
  });

  it('licensure is access-required and stays VISIBLE', () => {
    const html = renderResolved(REGISTRY_BOOT, FULL_TRUST);
    const row = build(REGISTRY_BOOT, FULL_TRUST).rows.find((r) => r.id === 'licensure')!;
    expect(row.kind).toBe('unavailable');
    expect(row.cadence).toBe('access-gated');
    expect(html).toContain('State licensure');
    expect(html).toContain('Unavailable without additional access');
  });

  it('a partial trust-state still renders every lane it did not hear from', () => {
    const model = build(REGISTRY_BOOT, { identityVerified: true });
    // Identity returned; licensure unavailable. Nothing silently vanishes.
    expect(model.rows.map((r) => r.id)).toContain('identity');
    expect(model.rows.map((r) => r.id)).toContain('licensure');
  });

  it('a missing trust-state produces no source claim at all', () => {
    const model = build(REGISTRY_BOOT, null);
    expect(rowsOfKind(model, 'returned')).toHaveLength(0);
    expect(rowsOfKind(model, 'attention')).toHaveLength(0);
    // Licensure is still named as unread rather than dropped.
    expect(rowsOfKind(model, 'unavailable').map((r) => r.id)).toEqual(['licensure']);
  });

  it('surfaces engine blockers without duplicating the PECOS row', () => {
    const model = build(REGISTRY_BOOT, {
      ...FULL_TRUST,
      blockers: ['PECOS enrollment is missing', 'Primary source contact is out of date'],
    });
    const attention = rowsOfKind(model, 'attention');
    expect(attention.filter((r) => /pecos/i.test(r.returned))).toHaveLength(0);
    expect(attention.some((r) => r.returned === 'Primary source contact is out of date')).toBe(true);
  });
});

describe('evidence capsule — identity provenance', () => {
  it('renders a registry-derived name under the registry framing', () => {
    const html = renderResolved(REGISTRY_BOOT, FULL_TRUST);
    expect(html).toContain('Avery Testprovider');
    expect(html).toContain('located in NPPES');
  });

  it('never presents a self-entered account name as the registry record', () => {
    // The production incident: a seeded profile rendered as the NPPES identity
    // of a real provider's NPI.
    const model = build(LEGACY_BOOT, FULL_TRUST);
    expect(model.identity.fromRegistry).toBe(false);
    expect(model.identity.name).toBeNull();

    const html = renderResolved(LEGACY_BOOT, FULL_TRUST);
    expect(html).not.toContain('Sarah Chen');
    expect(html).not.toContain('located in NPPES');
    expect(html).toContain(`NPI ${NPI}`);
  });

  it('keeps the registryIdentity gate exactly as the pinned test expects', () => {
    expect(registryIdentity(null).fromRegistry).toBe(false);
    expect(registryIdentity({ identitySource: 'NPPES_API' }).fromRegistry).toBe(true);
    expect(registryIdentity({ alreadyRegistered: true }).fromRegistry).toBe(false);
    expect(registryIdentity({ alreadyRegistered: false }).fromRegistry).toBe(true);
    // A labelled payload wins over the registration flag, in both directions.
    expect(registryIdentity({ identitySource: 'ACCOUNT', alreadyRegistered: false }).fromRegistry).toBe(false);
  });
});

describe('evidence capsule — nothing manufactured', () => {
  it('carries no observation time, because the payload provides none', () => {
    const model = build(REGISTRY_BOOT, FULL_TRUST);
    for (const row of model.rows) expect(row.observedAt).toBeNull();

    const html = renderResolved(REGISTRY_BOOT, FULL_TRUST);
    // No date, no clock time, no "ago", no "just now".
    expect(html).not.toMatch(/\b\d{4}-\d{2}-\d{2}\b/);
    expect(html).not.toMatch(/\b\d{1,2}:\d{2}\s*(am|pm)?\b/i);
    expect(html).not.toMatch(/\bago\b|\bjust now\b|\bas of\b/i);
    // …and it says so, rather than letting silence imply freshness.
    expect(html).toMatch(/no per-check observation time is available/i);
  });

  it('invents no score, percentage, confidence or ranking', () => {
    const html = renderResolved(REGISTRY_BOOT, FULL_TRUST);
    expect(html).not.toMatch(/\d+\s*%/);
    expect(html).not.toMatch(/\bscore\b|\bconfidence\b|\breadiness level\b|\brating\b/i);
  });

  it('makes no absolute verification claim and uses no bare Verified label', () => {
    const html = renderResolved(REGISTRY_BOOT, FULL_TRUST);
    expect(html).not.toMatch(/>\s*Verified\s*</);
    const lower = html.toLowerCase();
    for (const banned of [
      'automatically verified',
      'guaranteed verification',
      'complete credentialing',
      'instant credentialing',
      'legally accepted',
      'risk transferred',
      'certified compliant',
      'hipaa compliant',
    ]) {
      expect(lower).not.toContain(banned);
    }
  });

  it('keeps the institution as the decision owner', () => {
    const html = renderResolved(REGISTRY_BOOT, FULL_TRUST);
    expect(html).toMatch(/not a completed credentialing decision/i);
    expect(html).toMatch(/institution makes that call/i);
  });

  it('drops absent provenance parts rather than filling them in', () => {
    const parts = provenanceParts({
      id: 'x',
      claim: 'c',
      source: null,
      returned: 'r',
      cadence: null,
      limitation: null,
      observedAt: null,
      kind: 'attention',
    });
    expect(parts).toEqual([]);
  });
});

describe('evidence capsule — system error', () => {
  const html = renderToStaticMarkup(
    React.createElement(EvidenceCapsuleError, { npi: NPI, onReset: () => undefined }),
  );

  it('says plainly that this is a system state, not a finding', () => {
    expect(html).toMatch(/system state, not a finding/i);
    expect(html).toContain(NPI);
  });

  it('implies no failed credential and no misconduct', () => {
    const lower = html.toLowerCase();
    for (const forbidden of ['excluded', 'failed', 'denied', 'rejected', 'not eligible', 'sanction']) {
      expect(lower).not.toContain(forbidden);
    }
  });

  it('offers a retry and announces itself', () => {
    expect(html).toMatch(/try another npi/i);
    expect(html).toContain('role="status"');
  });
});

describe('evidence capsule — accessibility and governance', () => {
  it('announces the resolved state concisely rather than reading every row', () => {
    const html = renderResolved(REGISTRY_BOOT, FULL_TRUST);
    expect(html).toContain('role="status"');
    expect(html).toMatch(/Lookup complete for NPI/);
    // Only NON-EMPTY groups are named. Announcing "0 returned by source" would
    // put those words on a page where no source returned anything at all —
    // which is exactly the trust-state-outage case below.
    const noSources = renderResolved(REGISTRY_BOOT, null);
    expect(noSources).not.toMatch(/0 returned/);
    expect(noSources).not.toMatch(/returned by a named source/);
    expect(noSources).toMatch(/1 unavailable without additional access/);
  });

  it('never communicates a group by glyph or colour alone', () => {
    const html = renderResolved(REGISTRY_BOOT, FULL_TRUST);
    for (const mark of html.match(/<svg[^>]*evidence-capsule__mark[^>]*>/g) ?? []) {
      expect(mark).toContain('aria-hidden="true"');
    }
    // Each group's meaning is carried by its heading text.
    expect(html).toContain('Returned by source');
    expect(html).toContain('Needs your attention');
    expect(html).toContain('Unavailable without additional access');
  });

  it('adds no raw lucide import', () => {
    for (const file of ['components/home/evidence/EvidenceCapsule.tsx', 'components/home/LiveNpiResult.tsx']) {
      const source = readFileSync(join(__dirname, '..', file), 'utf8');
      expect(source).not.toMatch(/from\s+['"]lucide-react['"]/);
    }
  });

  it('keeps the model a pure transform — no fetch, no storage, no clock', () => {
    const source = readFileSync(
      join(__dirname, '..', 'components', 'home', 'evidence', 'evidenceCapsuleModel.ts'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    for (const forbidden of ['fetch(', 'localStorage', 'sessionStorage', 'Date.now', 'new Date']) {
      expect(source).not.toContain(forbidden);
    }
  });
});

/**
 * The capsule's stylesheet moved.
 *
 * `styles/evidence-capsule.css` was deleted by the homepage recovery (#1060).
 * That file, and `home-surfaces.css` alongside it, were the ONLY definitions of
 * `.evidence-capsule*` — and neither was imported by any route that rendered the
 * capsule. The lookup worked, the answer arrived, and it painted as unstyled
 * text in production while THIS suite read the orphaned file off disk and passed.
 *
 * So the rules now live in `styles/home.css`, imported by `app/page.tsx`, and
 * these assertions read the capsule's slice of that file. The import-contract
 * test below is the part that would actually have caught the original P0.
 */
const HOME_CSS_PATH = join(__dirname, '..', 'styles', 'home.css');

/** The `.evidence-capsule*` rules only — the same scope the old file had. */
function capsuleSlice(css: string): string {
  const rules = css.match(/^\.evidence-capsule[^{]*\{[^}]*\}/gm) ?? [];
  return rules.join('\n');
}

describe('evidence capsule stylesheet', () => {
  const css = readFileSync(HOME_CSS_PATH, 'utf8');
  const declarations = capsuleSlice(css.replace(/\/\*[\s\S]*?\*\//g, ''));

  it('still has rules to check (guard cannot silently pass on zero)', () => {
    // Without this, a rename of the block would empty every assertion below and
    // the suite would go green on an unstyled capsule — the exact failure the
    // deleted stylesheet produced.
    expect(declarations.split('\n').filter((l) => l.startsWith('.evidence-capsule')).length)
      .toBeGreaterThan(15);
  });

  it('uses tokens only', () => {
    expect(declarations).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(?:oklch|rgba?|hsla?)\(/);
    expect(declarations).not.toMatch(/z-index\s*:\s*-?\d/);
    for (const font of declarations.match(/font-family\s*:\s*[^;]+/g) ?? []) {
      expect(font).toMatch(/font-family\s*:\s*var\(/);
    }
    for (const shadow of declarations.match(/box-shadow\s*:\s*[^;]+/g) ?? []) {
      expect(shadow).toMatch(/box-shadow\s*:\s*(?:none|var\()/);
    }
  });

  it('shares the record radius so the answer belongs to the question', () => {
    // Previously `var(--home-capsule-radius)`, a token that existed only to be
    // shared with the input. The composition now states the same relationship
    // directly: the capsule is the same object family as every other record
    // surface on the page, so it carries the same corner.
    const radiusOf = (selector: string) =>
      css.match(new RegExp(`\\${selector}\\s*\\{[^}]*?border-radius:\\s*([^;]+);`))?.[1]?.trim();

    const capsule = radiusOf('.evidence-capsule');
    expect(capsule).toBeTruthy();
    expect(radiusOf('.film-strip')).toBe(capsule);
    expect(radiusOf('.film-consent')).toBe(capsule);
  });

  it('keeps motion finite and reduced-motion-safe', () => {
    // The stylesheet's reduced-motion contract, unchanged in substance: a
    // `reduce` block that neutralises every transition and animation under
    // `.film`, and nothing anywhere that loops or hijacks scrolling.
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toMatch(/animation-iteration-count:\s*1\s*!important/);
    expect(css).not.toMatch(/animation[^;]*\binfinite\b/);
    expect(css).not.toContain('@keyframes');
    expect(css).not.toContain('scroll-snap-type');
  });

  it('reserves green for the one thing it means', () => {
    // CD-3: green = a named source returned a match. It may appear on the
    // `returned` group and nowhere else. The capsule currently claims it
    // nowhere, which satisfies the rule; if it is ever introduced it may only
    // land on `returned`.
    for (const line of declarations.split('\n')) {
      if (!line.includes('--vt-state-source-confirmed')) continue;
      const idx = declarations.indexOf(line);
      expect(declarations.slice(Math.max(0, idx - 220), idx)).toMatch(
        /data-evidence-group=['"]returned['"]/,
      );
    }
  });
});

/**
 * THE REGRESSION THIS WHOLE CHANGE EXISTS FOR.
 *
 * A stylesheet read off disk by a test proves nothing about what the browser
 * loads. `.evidence-capsule` was fully defined, fully token-clean, and fully
 * asserted here — and completely absent from the page, because no route
 * imported the file it lived in.
 *
 * This closes the loop: follow `app/page.tsx`'s own CSS imports and require
 * that one of them really defines the capsule.
 */
describe('evidence capsule is reachable from the route that renders it', () => {
  const pagePath = join(__dirname, '..', 'app', 'page.tsx');
  const pageSource = readFileSync(pagePath, 'utf8');

  /** Every `import '...css'` in page.tsx, resolved to a path on disk. */
  const importedStylesheets = [...pageSource.matchAll(/import\s+['"]([^'"]+\.css)['"]/g)]
    .map((m) => m[1])
    .map((specifier) =>
      specifier.startsWith('@/')
        ? join(__dirname, '..', specifier.slice(2))
        : join(__dirname, '..', 'app', specifier),
    );

  it('imports at least one stylesheet', () => {
    expect(importedStylesheets.length).toBeGreaterThan(0);
  });

  it('one of those stylesheets actually defines .evidence-capsule', () => {
    const defining = importedStylesheets.filter((path) =>
      readFileSync(path, 'utf8').includes('.evidence-capsule'),
    );

    expect(
      defining,
      'app/page.tsx renders the evidence capsule but imports no stylesheet that ' +
        'defines `.evidence-capsule` — the capsule would paint as unstyled text. ' +
        `Imports checked: ${importedStylesheets.join(', ') || '(none)'}`,
    ).not.toEqual([]);
  });
});
