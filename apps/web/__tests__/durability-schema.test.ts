/**
 * DURABILITY-1 PR345A — durable schema additions lockdown.
 *
 * Pins the existence + shape of the two new Prisma models added by
 * this PR (CredentialStatus + CredentialStatusHistory + AuditExport)
 * AND verifies the three models the brief asked for that already
 * exist (ClinicianIdentity, IngestEvent, VerifierNonce). Reads the
 * schema as text so the assertion does not require a running
 * Prisma generator or DB.
 *
 * If any of these models are removed or have a field name changed,
 * this test fails — preventing silent drift.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCHEMA = readFileSync(
  resolve(__dirname, '../../../apps/api/backend/prisma/schema.prisma'),
  'utf8',
);

function modelBlock(name: string): string | null {
  // Capture from `model X {` through the matching closing `}`.
  const open = new RegExp(`^model ${name} \\{`, 'm').exec(SCHEMA);
  if (!open) return null;
  const start = open.index;
  // Walk forward, balancing braces.
  let depth = 0;
  let i = start;
  for (; i < SCHEMA.length; i++) {
    if (SCHEMA[i] === '{') depth += 1;
    else if (SCHEMA[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        return SCHEMA.slice(start, i + 1);
      }
    }
  }
  return null;
}

describe('DURABILITY-1 PR345A — existing models the brief asked for', () => {
  it('ClinicianIdentity exists (clinicians table)', () => {
    expect(modelBlock('ClinicianIdentity')).not.toBeNull();
  });

  it('IngestEvent exists (replay event table)', () => {
    const block = modelBlock('IngestEvent');
    expect(block).not.toBeNull();
    // Real event-replay surface: must carry ingest_run_id + sequence
    // + dedupe_key.
    expect(block).toContain('ingest_run_id');
    expect(block).toContain('sequence');
    expect(block).toContain('dedupe_key');
  });

  it('VerifierNonce exists (nonce table)', () => {
    const block = modelBlock('VerifierNonce');
    expect(block).not.toBeNull();
    expect(block).toContain('expiresAt');
    expect(block).toContain('used');
  });

  it('JtiReplay exists (anti-replay table)', () => {
    expect(modelBlock('JtiReplay')).not.toBeNull();
  });
});

describe('DURABILITY-1 PR345A — CredentialStatus (new in this PR)', () => {
  const block = modelBlock('CredentialStatus');

  it('model is present in schema.prisma', () => {
    expect(block).not.toBeNull();
  });

  it('credentialId is the primary key (matches credentialStatusUrl artifact id)', () => {
    expect(block).toMatch(/credentialId\s+String\s+@id/);
  });

  it('carries state + revoked + revokedAt fields', () => {
    expect(block).toMatch(/state\s+String/);
    expect(block).toMatch(/revoked\s+Boolean/);
    expect(block).toMatch(/revokedAt\s+DateTime\?/);
  });

  it('revokedAt is nullable but sticky (no default; set only on transition)', () => {
    expect(block).toContain('revokedAt    DateTime?');
    // No @default on revokedAt — preserved by setting it once.
    expect(block).not.toMatch(/revokedAt\s+DateTime\?\s+@default/);
  });

  it('carries issuerId for verifier-side filtering', () => {
    expect(block).toMatch(/issuerId\s+String/);
    expect(block).toContain('@@index([issuerId])');
  });

  it('indexes the revoked column for fast bitstring lookup', () => {
    expect(block).toContain('@@index([revoked])');
  });

  it('has a history relation for append-only transition records', () => {
    expect(block).toContain('history      CredentialStatusHistory[]');
  });
});

describe('DURABILITY-1 PR345A — CredentialStatusHistory (new in this PR)', () => {
  const block = modelBlock('CredentialStatusHistory');

  it('model is present', () => {
    expect(block).not.toBeNull();
  });

  it('FK to CredentialStatus.credentialId with onDelete: Cascade', () => {
    expect(block).toContain('@relation(fields: [credentialId], references: [credentialId], onDelete: Cascade)');
  });

  it('eventDigest is required (truth-contract: every transition is digestible)', () => {
    expect(block).toMatch(/eventDigest\s+String\s*$/m);
    // Not nullable.
    expect(block).not.toMatch(/eventDigest\s+String\?/);
  });

  it('ingestRunId is optional (system-driven transitions need not be ingest-bound)', () => {
    expect(block).toMatch(/ingestRunId\s+String\?\s+@db\.Uuid/);
  });

  it('actorClerkId is optional (some transitions are system-driven)', () => {
    expect(block).toMatch(/actorClerkId\s+String\?/);
  });

  it('indexes (credentialId, observedAt) for time-ordered lookups', () => {
    expect(block).toContain('@@index([credentialId, observedAt])');
  });

  it('indexes eventDigest for tamper-detection queries', () => {
    expect(block).toContain('@@index([eventDigest])');
  });
});

describe('DURABILITY-1 PR345A — AuditExport (new in this PR)', () => {
  const block = modelBlock('AuditExport');

  it('model is present', () => {
    expect(block).not.toBeNull();
  });

  it('digest is the primary key (idempotent: identical exports collapse)', () => {
    expect(block).toMatch(/digest\s+String\s+@id/);
  });

  it('actorClerkId is REQUIRED (no anonymous exports)', () => {
    // Not nullable; routes already gate on auth().userId.
    expect(block).toMatch(/actorClerkId\s+String\s*$/m);
    expect(block).not.toMatch(/actorClerkId\s+String\?/);
  });

  it('signed defaults to false (truth-contract: signed is never inferred)', () => {
    expect(block).toMatch(/signed\s+Boolean\s+@default\(false\)/);
  });

  it('signature is nullable (signed=false envelopes have no signature)', () => {
    expect(block).toMatch(/signature\s+String\?/);
  });

  it('envelopeSchema is required (schema-pin enforcement)', () => {
    expect(block).toMatch(/envelopeSchema\s+String\s*$/m);
  });

  it('indexes by actorClerkId + sealedAt for per-actor audit queries', () => {
    expect(block).toContain('@@index([actorClerkId, sealedAt])');
  });

  it('indexes by subjectNpi + sealedAt for per-clinician audit queries', () => {
    expect(block).toContain('@@index([subjectNpi, sealedAt])');
  });
});

describe('DURABILITY-1 PR345A — operational notes preserved in schema', () => {
  it('schema comments reference the brief + migration command', () => {
    expect(SCHEMA).toContain('DURABILITY-1 PR345A');
    expect(SCHEMA).toContain('prisma migrate dev');
  });

  it('schema notes the truth-contract digest scheme link', () => {
    expect(SCHEMA).toContain('canonical-JSON');
    expect(SCHEMA).toContain('#312');
    expect(SCHEMA).toContain('#318');
  });
});
