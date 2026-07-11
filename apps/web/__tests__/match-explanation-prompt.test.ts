import { describe, it, expect } from 'vitest';
import { buildMatchExplanationMessages } from '@/lib/matcha/matchExplanation';

describe('buildMatchExplanationMessages — grounding discipline', () => {
  const base = buildMatchExplanationMessages({
    opportunity: { title: 'Locums Hospitalist', organization: 'Metro Health', specialty: 'Hospital Medicine', location: 'Austin, TX' },
    matchBand: 'NEAR_CLEAR',
    fitReasons: [
      { label: 'Specialty matches your Hospital Medicine focus', positive: true },
      { label: 'A negative signal that must not be surfaced as a fit', positive: false },
    ],
    blockers: [{ label: 'TX license not yet source-verified', severity: 'hard' }],
    profileSummary: 'Hospitalist open to locums in the Southwest.',
  });

  it('forbids fabrication and guarantees in the system prompt', () => {
    expect(base.system).toMatch(/never invent/i);
    expect(base.system).toMatch(/not a job offer or guarantee/i);
    expect(base.system).toMatch(/2-3 sentences/i);
  });

  it('grounds the user prompt in the provided facts + honest blockers', () => {
    expect(base.user).toContain('Locums Hospitalist');
    expect(base.user).toContain('Metro Health');
    expect(base.user).toContain('Specialty matches your Hospital Medicine focus');
    expect(base.user).toContain('TX license not yet source-verified');
    expect(base.user).toContain('(hard)');
    // Only POSITIVE fit signals are offered as reasons; negatives are excluded.
    expect(base.user).not.toContain('must not be surfaced as a fit');
    // Self-stated summary is labeled as not source-verified.
    expect(base.user).toMatch(/self-stated, not source-verified/i);
  });

  it('degrades honestly when no signals are provided (never invents)', () => {
    const empty = buildMatchExplanationMessages({ opportunity: { title: 'Role' } });
    expect(empty.user).toContain('(no specific fit signals provided)');
    expect(empty.user).toContain('- (none)');
  });
});
