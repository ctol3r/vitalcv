import { describe, expect, it } from 'vitest';
import { buildParsePreview, resolveCommandInput } from '../lib/command/parser';

describe('resolveCommandInput', () => {
  it('treats provider names as search mode', () => {
    const input = resolveCommandInput('Dr Jane Smith');

    expect(input.mode).toBe('search');
    expect(input.searchText).toBe('Dr Jane Smith');
    expect(input.parseSummary?.providers).toContain('Dr Jane Smith');
  });

  it('treats NPI lookup text as search mode', () => {
    const input = resolveCommandInput('NPI 1234567890');

    expect(input.mode).toBe('search');
    expect(input.searchText).toBe('1234567890');
    expect(input.parseSummary?.providers).toContain('1234567890');
  });

  it('routes structured intelligence queries into copilot mode', () => {
    const input = resolveCommandInput('cardiologists in texas with high payments');
    const preview = buildParsePreview(input.parseSummary);

    expect(input.mode).toBe('copilot');
    expect(input.parseSummary?.specialty).toBe('Cardiology');
    expect(input.parseSummary?.state).toBe('TX');
    expect(input.parseSummary?.signal).toBe('payments');
    expect(input.parseSummary?.threshold).toBe('high');
    expect(preview).toEqual({
      specialty: 'Cardiology',
      state: 'TX',
      signal: 'payments',
      threshold: 'high',
    });
  });

  it('routes prefixed commands into command mode', () => {
    const input = resolveCommandInput('> export report 1234567890');

    expect(input.mode).toBe('command');
    expect(input.commandText).toBe('export report 1234567890');
    expect(input.parseSummary).toBeNull();
  });
});
