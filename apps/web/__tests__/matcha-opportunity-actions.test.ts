import { describe, expect, it } from 'vitest';

import {
  actionValueForTap,
  bucketFor,
  isOpportunityActionValue,
  mergeServerActions,
  statusCounts,
  type OpportunityActionMap,
} from '../lib/matcha/opportunityActions';
import { livabilityLookupUrl, locationLabel } from '../lib/matcha/livability';

describe('opportunity actions — buckets & counts', () => {
  it('treats an unacted opportunity as new', () => {
    expect(bucketFor({}, 'opp1')).toBe('new');
  });

  it('reflects recorded status', () => {
    const map: OpportunityActionMap = { opp1: 'saved', opp2: 'declined' };
    expect(bucketFor(map, 'opp1')).toBe('saved');
    expect(bucketFor(map, 'opp2')).toBe('declined');
  });

  it('counts new as ids with no recorded action, restricted to the given ids', () => {
    const map: OpportunityActionMap = { opp1: 'saved', opp2: 'connected', ghost: 'declined' };
    const counts = statusCounts(map, ['opp1', 'opp2', 'opp3', 'opp4']);
    expect(counts).toEqual({ new: 2, saved: 1, connected: 1, declined: 0 });
    // 'ghost' is not among the shown ids, so it does not inflate declined
  });

  it('is all-new for an empty action map', () => {
    expect(statusCounts({}, ['a', 'b', 'c'])).toEqual({ new: 3, saved: 0, connected: 0, declined: 0 });
  });
});

describe('opportunity actions — server persistence semantics (Wave K)', () => {
  it('maps a tap on a new status to that status', () => {
    expect(actionValueForTap({}, 'opp1', 'saved')).toBe('saved');
    expect(actionValueForTap({ opp1: 'saved' }, 'opp1', 'connected')).toBe('connected');
  });

  it("maps a tap on the already-active status to 'cleared' (append-only toggle-off)", () => {
    expect(actionValueForTap({ opp1: 'saved' }, 'opp1', 'saved')).toBe('cleared');
    expect(actionValueForTap({ opp1: 'declined' }, 'opp1', 'declined')).toBe('cleared');
  });

  it('accepts exactly the four server action values', () => {
    expect(isOpportunityActionValue('saved')).toBe(true);
    expect(isOpportunityActionValue('connected')).toBe(true);
    expect(isOpportunityActionValue('declined')).toBe(true);
    expect(isOpportunityActionValue('cleared')).toBe(true);
    expect(isOpportunityActionValue('applied')).toBe(false);
    expect(isOpportunityActionValue('')).toBe(false);
    expect(isOpportunityActionValue(42)).toBe(false);
    expect(isOpportunityActionValue(null)).toBe(false);
  });

  it('merges server decisions over the local cache — server wins, cleared removes, local-only kept', () => {
    const local: OpportunityActionMap = { a: 'saved', b: 'connected', c: 'declined' };
    const merged = mergeServerActions(local, { a: 'declined', b: 'cleared', d: 'saved' });
    expect(merged).toEqual({ a: 'declined', c: 'declined', d: 'saved' });
  });

  it('is identity for an empty server map and does not mutate the input', () => {
    const local: OpportunityActionMap = { a: 'saved' };
    const merged = mergeServerActions(local, {});
    expect(merged).toEqual({ a: 'saved' });
    expect(merged).not.toBe(local);
    mergeServerActions(local, { a: 'cleared' });
    expect(local).toEqual({ a: 'saved' });
  });
});

describe('livability — honest external lookups', () => {
  it('builds an external search URL scoped to category + location', () => {
    const url = livabilityLookupUrl('cost_of_living', 'Oakland, CA');
    expect(url).toContain('https://www.google.com/search?q=');
    expect(decodeURIComponent(url)).toContain('Cost of living in Oakland, CA');
  });

  it('composes and de-duplicates the location label', () => {
    expect(locationLabel({ location: 'Oakland, CA', state: 'CA' })).toBe('Oakland, CA');
    expect(locationLabel({ location: 'Austin', state: 'TX' })).toBe('Austin, TX');
    expect(locationLabel({})).toBeNull();
  });
});
