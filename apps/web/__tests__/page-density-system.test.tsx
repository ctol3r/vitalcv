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
    expect(inventory).toHaveLength(138);
    expect(inventory.every((item) => !item.source.includes('/_archive/'))).toBe(true);
    expect(inventory.every((item) => !item.route.startsWith('/api/'))).toBe(true);
    expect(new Set(inventory.map((item) => item.density))).toEqual(
      new Set(['marketing', 'product', 'workflow', 'focused-form']),
    );
  });
});
