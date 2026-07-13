import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Wave1505Client from '@/components/design-wave1505/Wave1505Client';
import { parseRoute5 } from '@/components/design-wave1505/shared';
import {
  ContactRoute, IndexRoute, PricingRoute, Sys404, SysError,
} from '@/components/design-wave1505/views-core';
import { AuditRoute } from '@/components/design-wave1505/views-governance';
import { WAVE1505_CSS } from '@/components/design-wave1505/styles';

/**
 * Wave 1505 port contract — /design/wave1505.
 *
 * Pins the fail-closed copy the design wave recorded as reusable verbatim
 * (CHANGES.md "Decisions recorded"), the port's honesty adaptations (design
 * reference strip, no fabricated receipts, no bare "Verified" label), and the
 * .w1505 style scoping that keeps the paper theme out of the app shell.
 */

describe('wave1505 hash router', () => {
  it('parses the wave routes', () => {
    expect(parseRoute5('#/').name).toBe('index');
    expect(parseRoute5('#/auth')).toEqual({ name: 'auth', sub: 'overview' });
    expect(parseRoute5('#/auth/sign-in')).toEqual({ name: 'auth', sub: 'sign-in' });
    expect(parseRoute5('#/auth/loading')).toEqual({ name: 'auth', sub: 'loading' });
    expect(parseRoute5('#/legal/dpa')).toEqual({ name: 'legal', doc: 'dpa' });
    expect(parseRoute5('#/system').name).toBe('system');
    expect(parseRoute5('#/contact').name).toBe('contact');
    expect(parseRoute5('#/pricing').name).toBe('pricing');
    expect(parseRoute5('#/audit').name).toBe('audit');
    expect(parseRoute5('#/dev/design').name).toBe('devdesign');
    expect(parseRoute5('#/governance').name).toBe('governance');
  });

  it('routes unknown paths to the designed 404 with the requested path echoed', () => {
    const r = parseRoute5('#/definitely/not/a/route');
    expect(r.name).toBe('404');
    expect(r.requested).toBe('#/definitely/not/a/route');
    expect(parseRoute5('#/legal/not-a-doc').name).toBe('404');
    expect(parseRoute5('#/auth/nope').name).toBe('404');
  });
});

describe('wave1505 fail-closed system copy (CHANGES.md decisions, verbatim)', () => {
  it('404 keeps the recorded headline and echoes the request', () => {
    const html = renderToStaticMarkup(<Sys404 requested="/passport/old-share-link" />);
    expect(html).toContain('This page isn’t part of the record.');
    expect(html).toContain('/passport/old-share-link');
    expect(html).toContain('404 · NOT FOUND');
  });

  it('error page keeps the fail-closed doctrine line', () => {
    const html = renderToStaticMarkup(<SysError />);
    expect(html).toContain('Nothing was recorded as successful.');
    expect(html).toContain('Something failed on our side.');
    // errors are stated, never dressed up — no cheerful copy
    expect(html).not.toMatch(/almost there|oops/i);
  });
});

describe('wave1505 port honesty adaptations', () => {
  it('the chromed shell carries the design-reference disclaimer', () => {
    const html = renderToStaticMarkup(<Wave1505Client />);
    expect(html).toContain('Design reference · wave 1505');
    expect(html).toContain('illustrative fixture data');
    expect(html).toContain('Skip to content');
  });

  it('the contact demo success state transmits nothing and says so', () => {
    const html = renderToStaticMarkup(<ContactRoute />);
    // pristine form renders; the demo-success copy ships in the module either way
    expect(html).toContain('A person reads');
    const source = String(ContactRoute);
    expect(source).toContain('nothing was sent');
  });

  it('the pricing figure is labeled illustrative via HonestyLabel copy', () => {
    const html = renderToStaticMarkup(<PricingRoute />);
    expect(html).toContain('$1,500');
    expect(html).toContain('Illustrative figure — actual pilot pricing is set in the signed pilot scope');
    expect(html).toContain('$0');
  });

  it('audit rows never use the banned bare "Verified" label', () => {
    const html = renderToStaticMarkup(<AuditRoute />);
    expect(html).not.toMatch(/>Verified</);
    expect(html).toContain('Re-checked');
  });
});

describe('wave1505 index hub', () => {
  it('renders the six deliverables and acceptance list', () => {
    const html = renderToStaticMarkup(<IndexRoute />);
    expect(html).toContain('The pages nobody designs —');
    expect(html).toContain('Six deliverables');
    expect(html).toContain('Auth surfaces');
    expect(html).toContain('Error &amp; system states');
    expect(html).toContain('Legal prose template');
    expect(html).toContain('Governance artifacts');
    expect(html).toContain('Checked against the brief');
  });
});

describe('wave1505 style scoping', () => {
  it('defines tokens under .w1505, never :root/html/body', () => {
    expect(WAVE1505_CSS).not.toMatch(/:root\s*\{/);
    expect(WAVE1505_CSS).not.toMatch(/(^|\}|\n)\s*html[\s.{]/);
    expect(WAVE1505_CSS).not.toMatch(/(^|\}|\n)\s*body\s*\{/);
    expect(WAVE1505_CSS).toContain('.w1505 {');
  });

  it('keeps keyframes namespaced so they cannot collide with app animations', () => {
    const names = [...WAVE1505_CSS.matchAll(/@keyframes\s+([a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(n.startsWith('w1505-')).toBe(true);
  });

  it('scopes every rule selector under the .w1505 root', () => {
    // strip comments, then check each top-level selector chunk
    const css = WAVE1505_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    const selectorRe = /(?:^|\})\s*([^@{}]+?)\s*\{/g;
    let m: RegExpExecArray | null;
    const offenders: string[] = [];
    while ((m = selectorRe.exec(css)) !== null) {
      const sel = m[1].trim();
      if (!sel) continue;
      // keyframe steps (from/to/percentages) live inside @keyframes blocks
      if (/^(from|to|\d+%)/.test(sel)) continue;
      for (const part of sel.split(',')) {
        const p = part.trim();
        if (p && !p.startsWith('.w1505')) offenders.push(p);
      }
    }
    expect(offenders).toEqual([]);
  });
});
