import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCHEMA_PATH = resolve(
  __dirname,
  '../../api/backend/prisma/schema.prisma',
);
const MIGRATION_PATH = resolve(
  __dirname,
  '../../api/backend/prisma/migrations/20260504000000_issuer_persistence_scaffold/migration.sql',
);

const schema = readFileSync(SCHEMA_PATH, 'utf8');
const migration = readFileSync(MIGRATION_PATH, 'utf8');

describe('TRUST-PERSIST-1 — Issuer persistence scaffold (schema-only)', () => {
  describe('schema.prisma', () => {
    function modelBlock(name: string): string {
      const start = schema.indexOf(`model ${name} {`);
      expect(start).toBeGreaterThan(-1);
      const end = schema.indexOf('\n}', start);
      expect(end).toBeGreaterThan(start);
      return schema.slice(start, end);
    }

    function fieldRegex(name: string, type: string, ...attrs: string[]): RegExp {
      const escType = type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escAttrs = attrs.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const tail = escAttrs.length ? `\\s+${escAttrs.join('\\s+')}` : '';
      return new RegExp(`(^|\\n)\\s+${name}\\s+${escType}${tail}(\\s|$)`);
    }

    test('declares the IssuerRequest model with the expected fields', () => {
      const block = modelBlock('IssuerRequest');
      expect(block).toMatch(fieldRegex('id', 'String', '@id', '@default(uuid())', '@db.Uuid'));
      expect(block).toMatch(fieldRegex('requestId', 'String', '@unique'));
      expect(block).toMatch(fieldRegex('claimType', 'String'));
      expect(block).toMatch(fieldRegex('claimSummary', 'String'));
      expect(block).toMatch(fieldRegex('issuerCandidate', 'Json'));
      expect(block).toMatch(fieldRegex('route', 'Json'));
      expect(block).toMatch(fieldRegex('consent', 'Json'));
      expect(block).toMatch(fieldRegex('status', 'String'));
      expect(block).toMatch(fieldRegex('expiresAt', 'DateTime?'));
      expect(block).toMatch(/receiptCandidates\s+ReceiptCandidate\[\]/);
    });

    test('declares the ReceiptCandidate model with the expected fields', () => {
      const block = modelBlock('ReceiptCandidate');
      expect(block).toMatch(fieldRegex('candidateId', 'String', '@unique'));
      expect(block).toMatch(fieldRegex('basis', 'String'));
      expect(block).toMatch(fieldRegex('sourceOrganizationName', 'String'));
      expect(block).toMatch(fieldRegex('decisionGrade', 'Boolean', '@default(false)'));
      expect(block).toMatch(fieldRegex('proofTier', 'String?'));
      expect(block).toMatch(fieldRegex('recordedBy', 'String', '@default("demo")'));
    });

    test('links ReceiptCandidate to IssuerRequest via the requestId relation', () => {
      const block = modelBlock('ReceiptCandidate');
      expect(block).toMatch(
        /request\s+IssuerRequest\?\s+@relation\(fields:\s*\[requestId\],\s*references:\s*\[requestId\]\)/,
      );
      const issuerBlock = modelBlock('IssuerRequest');
      expect(issuerBlock).toMatch(/receiptCandidates\s+ReceiptCandidate\[\]/);
    });
  });

  describe('migration.sql', () => {
    test('creates IssuerRequest and ReceiptCandidate tables — additive only, no destructive ops', () => {
      expect(migration).toContain('CREATE TABLE "IssuerRequest"');
      expect(migration).toContain('CREATE TABLE "ReceiptCandidate"');
      expect(migration).not.toMatch(/DROP TABLE\b/);
      expect(migration).not.toMatch(/DROP COLUMN\b/);
      expect(migration).not.toMatch(/TRUNCATE\b/);
    });

    test('enforces ReceiptCandidate.decisionGrade = FALSE at the database level', () => {
      expect(migration).toContain(
        'CONSTRAINT "ReceiptCandidate_decisionGrade_must_be_false"',
      );
      expect(migration).toMatch(/CHECK\s*\(\s*"decisionGrade"\s*=\s*FALSE\s*\)/);
    });

    test('enforces ReceiptCandidate.proofTier literal at the database level', () => {
      expect(migration).toContain(
        'CONSTRAINT "ReceiptCandidate_proofTier_literal"',
      );
      expect(migration).toMatch(
        /CHECK\s*\(\s*"proofTier"\s+IS\s+NULL\s+OR\s+"proofTier"\s*=\s*'receipt_candidate'\s*\)/,
      );
    });

    test('enforces ReceiptCandidate.recordedBy enum at the database level', () => {
      expect(migration).toContain(
        'CONSTRAINT "ReceiptCandidate_recordedBy_enum"',
      );
      expect(migration).toMatch(
        /CHECK\s*\(\s*"recordedBy"\s+IN\s*\(\s*'demo'\s*,\s*'review_surface'\s*,\s*'system'\s*\)\s*\)/,
      );
    });

    test('declares the cross-table foreign key from ReceiptCandidate.requestId to IssuerRequest.requestId', () => {
      expect(migration).toContain(
        'CONSTRAINT "ReceiptCandidate_request_fk"',
      );
      expect(migration).toMatch(
        /FOREIGN\s+KEY\s*\(\s*"requestId"\s*\)\s+REFERENCES\s+"IssuerRequest"\s*\(\s*"requestId"\s*\)/,
      );
    });

    test('contains no banned-overclaim copy in comments', () => {
      // Banned phrases per CLAUDE.md. Stored as split-join fragments so
      // the literal strings never appear in source — Codex's banned-string
      // grep across the PR diff would otherwise treat this assertion list
      // itself as a violation.
      const banned: string[] = [
        ['automatically', 'verified'].join(' '),
        ['guaranteed', 'verification'].join(' '),
        ['complete', 'credentialing'].join(' '),
        ['instant', 'credentialing'].join(' '),
        ['legally', 'accepted'].join(' '),
        ['risk', 'transferred'].join(' '),
        ['final', 'verification', 'without', 'review'].join(' '),
        ['source', 'confirmed', 'before', 'response'].join(' '),
        ['certified', 'compliant'].join(' '),
        ['HIPAA', 'compliant'].join(' '),
        ['SOC2', 'certified'].join(' '),
      ];
      for (const phrase of banned) {
        expect(migration).not.toContain(phrase);
      }
    });
  });
});
