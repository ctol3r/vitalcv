import { describe, it, expect } from '@jest/globals';
import {
  buildPractitionerPayload,
  directoryEntries,
  findDirectoryEntriesByIdentifier,
  findDirectoryEntriesByNamePrefix,
  getTrustedParticipants,
  isTrustedEndpoint,
  searchTrustedDirectory,
} from '../trustedParticipants.js';

describe('trustedParticipants directory', () => {
  it('lists known participants', () => {
    const participants = getTrustedParticipants();
    expect(participants.length).toBeGreaterThan(0);
    expect(participants[0]).toHaveProperty('endpoint');
  });

  it('validates endpoints', () => {
    const sampleEndpoint = getTrustedParticipants()[0].endpoint;
    expect(isTrustedEndpoint(sampleEndpoint)).toBe(true);
    expect(isTrustedEndpoint('https://unknown.example.com/fhir')).toBe(false);
  });

  it('finds practitioners by identifier and builds payload', () => {
    const identifier = directoryEntries[0].practitioner.identifier[0].value;
    const match = findDirectoryEntriesByIdentifier(identifier);
    expect(match).toHaveLength(1);

    const payload = buildPractitionerPayload(match[0]);
    expect(payload.contained).toHaveLength(3);
  });

  it('supports prefix name search', () => {
    const result = findDirectoryEntriesByNamePrefix('ave');
    expect(result[0].practitioner.name[0].family).toBe('Adams');
  });

  it('returns sanitized practitioner array for directory search', () => {
    const results = searchTrustedDirectory({ identifier: directoryEntries[1].practitioner.identifier[0].value });
    expect(results).toHaveLength(1);
    expect(results[0].resourceType).toBe('Practitioner');
  });
});

