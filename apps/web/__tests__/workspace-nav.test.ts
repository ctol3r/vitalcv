import { describe, expect, it } from 'vitest';
import { WORKSPACE_SURFACES, workspaceNavLinks } from '../lib/workspace/nav';

// W600-C6 — the ONE canonical navigation: grouped portfolio + normalized terminology,
// shared by every surface so VitalCV reads as one product.

describe('workspaceNavLinks (W600)', () => {
  it('groups surfaces into the product portfolio in order', () => {
    const groups = workspaceNavLinks('entity-1').map((g) => g.group);
    expect(groups).toEqual(['Career', 'Trust', 'Growth', 'Organizations', 'Platform']);
  });

  it('builds entity-encoded hrefs for every surface (single source of truth)', () => {
    const links = workspaceNavLinks('a/b').flatMap((g) => g.links);
    expect(links).toHaveLength(WORKSPACE_SURFACES.length);
    expect(links.find((l) => l.id === 'ecosystem')?.href).toBe('/ecosystem/a%2Fb');
    expect(links.find((l) => l.id === 'professional-growth')?.href).toBe('/professional-growth/a%2Fb');
    expect(links.find((l) => l.id === 'network')?.href).toBe('/network/a%2Fb');
  });

  it('uses the normalized "Professional …" terminology (C4)', () => {
    const labels = workspaceNavLinks('e').flatMap((g) => g.links).map((l) => l.label);
    expect(labels).toContain('Professional Evidence');
    expect(labels).toContain('Professional Trust');
    expect(labels).toContain('Professional Growth');
    expect(labels).toContain('Professional Timeline');
  });

  it('is deterministic', () => {
    expect(workspaceNavLinks('x')).toEqual(workspaceNavLinks('x'));
  });
});
