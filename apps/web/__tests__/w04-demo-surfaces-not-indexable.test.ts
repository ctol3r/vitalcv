/**
 * W0.4 — demo and prototype surfaces are not indexable.
 *
 * /demo is honest on its face: it says the clinician is a curated example and
 * that sample data is demo data. But it shipped `index, follow`, so a search
 * engine could surface a sample clinician's ecosystem, recruiter review, or
 * proof packet as a VitalCV result stripped of that framing. The /design/*
 * prototypes already set noindex; /demo was the one that did not.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

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

describe('W0.4 — app/robots.ts is the file actually served', () => {
  /**
   * `public/robots.txt` beats `app/robots.ts` for the same path in Next.js.
   * One existed, committed in #122, publishing only /api/ and /internal/ — so
   * `app/robots.ts` was dead code and every rule anyone added to it
   * (/review/, /mission-ops/, /pilot-ops/, /holder/, /workspace/, then /demo
   * and /design/) was silently never served. Production served two rules while
   * the repo read as if it served nine.
   *
   * The assertions below read the route's return value, which is only
   * meaningful while nothing shadows it — a green suite proved nothing before.
   * This is the tripwire that keeps them honest: re-adding any static robots
   * file under public/ fails here.
   */
  it('has no static robots file shadowing the route', () => {
    for (const name of ['robots.txt', 'robots.TXT']) {
      expect(existsSync(join(__dirname, '..', 'public', name))).toBe(false);
    }
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
