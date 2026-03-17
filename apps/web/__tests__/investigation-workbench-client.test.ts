import { describe, expect, it } from 'vitest';
import {
  buildFindingStatusEndpoint,
  buildInvestigationWorkbenchRequestPath,
  buildInvestigationWorkbenchSearchParams,
  FINDING_STATUS_METHOD,
} from '../lib/intelligence/investigation-workbench-client';

describe('investigation workbench client helpers', () => {
  it('builds workbench params for npi-only anchors', () => {
    expect(buildInvestigationWorkbenchSearchParams({ npi: '1234567890' }).toString()).toBe('npi=1234567890');
    expect(buildInvestigationWorkbenchRequestPath({ npi: '1234567890' })).toBe(
      '/api/investigation/workbench?npi=1234567890',
    );
  });

  it('builds workbench params for finding-only anchors', () => {
    expect(buildInvestigationWorkbenchSearchParams({ findingId: 'finding-1' }).toString()).toBe('findingId=finding-1');
    expect(buildInvestigationWorkbenchRequestPath({ findingId: 'finding-1' })).toBe(
      '/api/investigation/workbench?findingId=finding-1',
    );
  });

  it('builds workbench params for storyline-only anchors', () => {
    expect(buildInvestigationWorkbenchSearchParams({ storylineId: 'story-1' }).toString()).toBe('storylineId=story-1');
    expect(buildInvestigationWorkbenchRequestPath({ storylineId: 'story-1' })).toBe(
      '/api/investigation/workbench?storylineId=story-1',
    );
  });

  it('preserves combined anchors and trims empty input', () => {
    expect(buildInvestigationWorkbenchSearchParams({
      npi: ' 1234567890 ',
      findingId: 'finding-1',
      storylineId: 'story-1',
    }).toString()).toBe('npi=1234567890&findingId=finding-1&storylineId=story-1');
    expect(buildInvestigationWorkbenchRequestPath({
      npi: ' 1234567890 ',
      findingId: 'finding-1',
      storylineId: 'story-1',
    })).toBe('/api/investigation/workbench?npi=1234567890&findingId=finding-1&storylineId=story-1');
    expect(buildInvestigationWorkbenchRequestPath({ npi: '   ' })).toBe('/api/investigation/workbench');
  });

  it('exports the corrected finding status route and method', () => {
    expect(buildFindingStatusEndpoint('finding-1')).toBe('/api/findings/finding-1/status');
    expect(FINDING_STATUS_METHOD).toBe('PATCH');
  });
});
