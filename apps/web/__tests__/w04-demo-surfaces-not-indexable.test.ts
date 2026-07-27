/**
 * W0.4 — demo and prototype surfaces are not indexable.
 *
 * /demo is honest on its face: it says the clinician is a curated example and
 * that sample data is demo data. But it shipped `index, follow`, so a search
 * engine could surface a sample clinician's ecosystem, recruiter review, or
 * proof packet as a VitalCV result stripped of that framing. The /design/*
 * prototypes already set noindex; /demo was the one that did not.
 */

import { describe, expect, it } from 'vitest';

import { metadata as demoMetadata } from '@/app/demo/page';
import robots from '@/app/robots';

describe('W0.4 — /demo is not indexable', () => {
  it('declares noindex, nofollow', () => {
    expect(demoMetadata.robots).toEqual({ index: false, follow: false });
  });

  it('keeps its honest title', () => {
    // Not indexable is not the same as hidden — the page stays reachable and
    // still says what it is.
    expect(demoMetadata.title).toMatch(/demo/i);
  });
});

describe('W0.4 — robots.txt disallows demo and prototype trees', () => {
  const rules = robots().rules;
  const rule = Array.isArray(rules) ? rules[0] : rules;
  const disallow = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow];

  it.each(['/demo', '/design/'])('disallows %s', (path) => {
    expect(disallow).toContain(path);
  });

  it('still disallows the previously protected trees', () => {
    for (const path of ['/api/', '/internal/', '/holder/', '/workspace/']) {
      expect(disallow).toContain(path);
    }
  });

  it('does not disallow the public acquisition surfaces', () => {
    for (const path of ['/employers', '/trust', '/status', '/']) {
      expect(disallow).not.toContain(path);
    }
  });
});
