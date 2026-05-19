import { describe, expect, it } from 'vitest';

import {
  DEPLOYMENT_KIT_CLIENTS,
  resolveDeploymentKitClient,
} from '@/app/pilot/deployment-kit/[clientSlug]/data';

describe('deployment kit data shape', () => {
  it('ships a Cedar Health Q2-26 cohort by default', () => {
    const cedar = resolveDeploymentKitClient('cedar-q2-26');
    expect(cedar).not.toBeNull();
    expect(cedar?.clientName).toBe('Cedar Health Credentialing');
    expect(cedar?.scopeNpis).toBe(10);
    expect(cedar?.scopeWindowDays).toBe(30);
    expect(cedar?.docNumber).toBe('VC-PDK-CEDAR-Q2-26');
  });

  it('returns null for unknown slugs', () => {
    expect(resolveDeploymentKitClient('does-not-exist')).toBeNull();
  });

  it('every cohort has the full contact set populated', () => {
    for (const slug of Object.keys(DEPLOYMENT_KIT_CLIENTS)) {
      const client = DEPLOYMENT_KIT_CLIENTS[slug];
      expect(client.contacts.pilotOwner).toBeTruthy();
      expect(client.contacts.credentialingLead).toBeTruthy();
      expect(client.contacts.auditLead).toBeTruthy();
      expect(client.contacts.securityReview).toBeTruthy();
      expect(client.contacts.legalContact).toBeTruthy();
      expect(client.contacts.escalation).toBeTruthy();
    }
  });

  it('every cohort has a sample NPI for the architecture rail', () => {
    for (const slug of Object.keys(DEPLOYMENT_KIT_CLIENTS)) {
      const client = DEPLOYMENT_KIT_CLIENTS[slug];
      expect(client.cohortSampleNpi.name).toBeTruthy();
      expect(client.cohortSampleNpi.npi).toMatch(/^\d{10}$/);
    }
  });
});

describe('truth-contract · pilot deployment kit copy', () => {
  // Note: the source HTML uses cryptographic language that is supported
  // by the underlying issuer infrastructure (did:web, ed25519, JWS).
  // This test confirms no banned-by-CLAUDE.md phrases were introduced.
  const banned = [
    'automatically verified',
    'guaranteed verification',
    'complete credentialing',
    'instant credentialing',
    'legally accepted',
    'risk transferred',
    'final verification without review',
    'source confirmed before response',
    'certified compliant',
    'hipaa compliant',
    'soc2 certified',
  ];

  it('no banned-phrase tokens appear in the data shape', () => {
    const dump = JSON.stringify(DEPLOYMENT_KIT_CLIENTS).toLowerCase();
    for (const token of banned) {
      expect(dump.includes(token), `should not contain "${token}"`).toBe(false);
    }
  });
});
