import { beforeEach, describe, expect, it } from 'vitest';
import { checkAiLimit, resetAiLimits } from '@/lib/ai/rateLimit';

describe('checkAiLimit — AI spend guardrails', () => {
  beforeEach(() => {
    resetAiLimits();
    delete process.env.AI_CALLS_PER_USER_PER_HOUR;
    delete process.env.AI_CALLS_GLOBAL_PER_DAY;
  });

  it('allows calls under the per-user cap and blocks at the cap', () => {
    process.env.AI_CALLS_PER_USER_PER_HOUR = '3';
    expect(checkAiLimit('user_a').ok).toBe(true);
    expect(checkAiLimit('user_a').ok).toBe(true);
    expect(checkAiLimit('user_a').ok).toBe(true);
    const fourth = checkAiLimit('user_a');
    expect(fourth.ok).toBe(false);
    if (!fourth.ok) expect(fourth.reason).toMatch(/hourly/i);
  });

  it('caps are per-user — one user at the cap does not block another', () => {
    process.env.AI_CALLS_PER_USER_PER_HOUR = '1';
    expect(checkAiLimit('user_a').ok).toBe(true);
    expect(checkAiLimit('user_a').ok).toBe(false);
    expect(checkAiLimit('user_b').ok).toBe(true);
  });

  it('enforces the global daily ceiling across users', () => {
    process.env.AI_CALLS_GLOBAL_PER_DAY = '2';
    expect(checkAiLimit('user_a').ok).toBe(true);
    expect(checkAiLimit('user_b').ok).toBe(true);
    const third = checkAiLimit('user_c');
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.reason).toMatch(/daily/i);
  });
});
