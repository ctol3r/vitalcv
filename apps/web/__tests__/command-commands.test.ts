import { describe, expect, it } from 'vitest';
import { buildIntelligenceHref } from '../lib/intelligence/routes';
import { buildCommandContext, findMatchingCommands } from '../lib/command/commands';
import { resolveCommandInput } from '../lib/command/parser';

describe('command registry', () => {
  it('prioritizes exact alias matches', () => {
    const matches = findMatchingCommands('export report');

    expect(matches[0]?.id).toBe('export-report');
  });

  it('builds provider-scoped export routes from command text', () => {
    const input = resolveCommandInput('> export report 1234567890');
    const matches = findMatchingCommands(input.commandText);
    const exportCommand = matches.find((command) => command.id === 'export-report');

    expect(exportCommand).toBeDefined();

    const context = buildCommandContext(input, null);
    expect(context.npi).toBe('1234567890');
    expect(exportCommand?.buildHref(context)).toBe('/api/trust-proof/1234567890?format=pdf');
    const graphHref = exportCommand?.buildGraphHref?.(context);
    const expectedHref = new URL(buildIntelligenceHref('dashboard', { npi: '1234567890', panel: 'graph' }), 'https://vitalcv.local');
    const actualHref = new URL(graphHref ?? '', 'https://vitalcv.local');

    expect(actualHref.pathname).toBe(expectedHref.pathname);
    expect(actualHref.searchParams.get('view')).toBe('dashboard');
    expect(actualHref.searchParams.get('panel')).toBe('graph');
    expect(actualHref.searchParams.get('npi')).toBe('1234567890');
  });
});
