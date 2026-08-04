import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PageFrame } from '@/components/layout/PageFrame';

const REPO = resolve(process.cwd(), '../..');

describe('page density system', () => {
  it.each(['marketing', 'product', 'workflow', 'focused-form'] as const)(
    'renders the %s mode as a stable layout contract',
    (mode) => {
      const html = renderToStaticMarkup(<PageFrame mode={mode}>Content</PageFrame>);
      expect(html).toContain('class="vcv-page-frame"');
      expect(html).toContain(`data-page-density="${mode}"`);
    },
  );

  it('defines width, gutter, block, section, and card rhythm for every mode', () => {
    const css = readFileSync(resolve(process.cwd(), 'styles/page-density.css'), 'utf8');
    for (const mode of ['marketing', 'product', 'workflow', 'focused-form']) {
      const block = css.match(new RegExp(`\\[data-page-density='${mode}'\\] \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
      expect(block).toContain('--vcv-page-max');
      expect(block).toContain('--vcv-page-gutter');
      expect(block).toContain('--vcv-page-block');
      expect(block).toContain('--vcv-page-section-gap');
      expect(block).toContain('--vcv-page-card-gap');
    }
  });

  it('classifies every non-archived page and never inventories an API or archive route', () => {
    const raw = execFileSync('node', [resolve(REPO, 'scripts/audit-active-routes.mjs'), '--json'], {
      encoding: 'utf8',
    });
    const inventory = JSON.parse(raw) as Array<{ route: string; source: string; density: string }>;
    // 137 = 136 + the SHD-3.1 /dev/story-rail harness (dev-gated, noindex).
    // 141 = 138 baseline pages + the /design/wave1501 homepage design
    // reference (noindex) + the canonical employer application queue and
    // its application-detail route.
    // 142 = 141 + the COMPETE-2 /dev/compete-film harness (dev-gated, noindex).
    // 143 = 142 + the public, indexable provider record at /directory/[npi].
    // 150 = 143 + the six Career Garden workspace pages under /holder/garden
    // (home, cv, notes, research, opportunities, privacy) + the
    // /dev/career-garden harness (dev-gated, noindex).
    // Back to 150: /design/spine was a prototype for the four-step spine.
    // The spine shipped into the homepage itself (#973), so the reference
    // route was removed rather than left as a second, drifting copy.
    // 151 = 150 + the restored public opportunities board at /explore. The route
    // was already public in roles.ts and monitored by launch-ops, but its page
    // had been archived — so /explore 404'd while four surfaces linked to it.
    // 152 = 151 + the Z1 homepage story (added as /design/z1-home, then moved
    // to the public /preview/home when the founder directed it live on
    // production; noindex until it replaces '/').
    expect(inventory).toHaveLength(152);
    expect(inventory.every((item) => !item.source.includes('/_archive/'))).toBe(true);
    expect(inventory.every((item) => !item.route.startsWith('/api/'))).toBe(true);
    expect(new Set(inventory.map((item) => item.density))).toEqual(
      new Set(['marketing', 'product', 'workflow', 'focused-form']),
    );
  });
});
