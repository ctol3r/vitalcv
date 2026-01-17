import { describe, it, expect } from 'vitest';
import { createReceipt, verifyReceipt, generateTestKeyPair, AuditReceipt } from '../index';

describe('Audit Receipts', () => {
  describe('createReceipt', () => {
    it('generates a receipt with all required fields', async () => {
      const { privateKey } = await generateTestKeyPair();

      const receipt = await createReceipt(
        'CREDENTIAL_ISSUED',
        { type: 'issuer', id: 'did:key:issuer-123' },
        { credential_id: 'cred-001', issuer_did: 'did:key:issuer-123' },
        'VALID',
        { test: true },
        privateKey
      );

      expect(receipt.receipt_id).toBeTruthy();
      expect(receipt.event_type).toBe('CREDENTIAL_ISSUED');
      expect(receipt.timestamp).toBeTruthy();
      expect(receipt.actor.type).toBe('issuer');
      expect(receipt.subject.credential_id).toBe('cred-001');
      expect(receipt.outcome).toBe('VALID');
      expect(receipt.metadata.test).toBe(true);
      expect(receipt.signature.jws).toBeTruthy();
      expect(receipt.signature.alg).toBe('EdDSA');
    });

    it('generates unique receipt IDs', async () => {
      const { privateKey } = await generateTestKeyPair();

      const receipt1 = await createReceipt(
        'CREDENTIAL_ISSUED',
        { type: 'issuer', id: 'did:key:issuer-123' },
        { credential_id: 'cred-001', issuer_did: 'did:key:issuer-123' },
        'VALID',
        {},
        privateKey
      );

      const receipt2 = await createReceipt(
        'CREDENTIAL_ISSUED',
        { type: 'issuer', id: 'did:key:issuer-123' },
        { credential_id: 'cred-002', issuer_did: 'did:key:issuer-123' },
        'VALID',
        {},
        privateKey
      );

      expect(receipt1.receipt_id).not.toBe(receipt2.receipt_id);
    });

    it('signs the receipt with JWS', async () => {
      const { privateKey } = await generateTestKeyPair();

      const receipt = await createReceipt(
        'CREDENTIAL_VERIFIED',
        { type: 'verifier', id: 'did:key:verifier-456' },
        { credential_id: 'cred-001', issuer_did: 'did:key:issuer-123' },
        'VALID',
        {},
        privateKey
      );

      expect(receipt.signature.jws).toMatch(/^eyJ/); // JWT format
    });
  });

  describe('verifyReceipt', () => {
    it('verifies a valid receipt signature', async () => {
      const { privateKey, publicKey } = await generateTestKeyPair();

      const receipt = await createReceipt(
        'CREDENTIAL_ISSUED',
        { type: 'issuer', id: 'did:key:issuer-123' },
        { credential_id: 'cred-001', issuer_did: 'did:key:issuer-123' },
        'VALID',
        {},
        privateKey
      );

      const isValid = await verifyReceipt(receipt, publicKey);

      expect(isValid).toBe(true);
    });

    it('rejects tampered receipt', async () => {
      const { privateKey, publicKey } = await generateTestKeyPair();

      const receipt = await createReceipt(
        'CREDENTIAL_ISSUED',
        { type: 'issuer', id: 'did:key:issuer-123' },
        { credential_id: 'cred-001', issuer_did: 'did:key:issuer-123' },
        'VALID',
        {},
        privateKey
      );

      // Tamper with receipt (despite being frozen, we can create a new object)
      const tamperedReceipt: AuditReceipt = {
        ...receipt,
        outcome: 'REVOKED', // Change outcome
      };

      const isValid = await verifyReceipt(tamperedReceipt, publicKey);

      expect(isValid).toBe(false);
    });

    it('rejects receipt with wrong public key', async () => {
      const { privateKey: privateKey1 } = await generateTestKeyPair();
      const { publicKey: publicKey2 } = await generateTestKeyPair();

      const receipt = await createReceipt(
        'CREDENTIAL_ISSUED',
        { type: 'issuer', id: 'did:key:issuer-123' },
        { credential_id: 'cred-001', issuer_did: 'did:key:issuer-123' },
        'VALID',
        {},
        privateKey1
      );

      const isValid = await verifyReceipt(receipt, publicKey2);

      expect(isValid).toBe(false);
    });
  });

  describe('immutability', () => {
    it('freezes receipt object to prevent modification', async () => {
      const { privateKey } = await generateTestKeyPair();

      const receipt = await createReceipt(
        'CREDENTIAL_ISSUED',
        { type: 'issuer', id: 'did:key:issuer-123' },
        { credential_id: 'cred-001', issuer_did: 'did:key:issuer-123' },
        'VALID',
        {},
        privateKey
      );

      expect(Object.isFrozen(receipt)).toBe(true);

      // Attempt to modify (should fail silently or throw in strict mode)
      expect(() => {
        (receipt as any).outcome = 'REVOKED';
      }).toThrow();
    });
  });

  describe('event types', () => {
    it('supports CREDENTIAL_ISSUED event', async () => {
      const { privateKey } = await generateTestKeyPair();

      const receipt = await createReceipt(
        'CREDENTIAL_ISSUED',
        { type: 'issuer', id: 'did:key:issuer-123' },
        { credential_id: 'cred-001', issuer_did: 'did:key:issuer-123' },
        'VALID',
        {},
        privateKey
      );

      expect(receipt.event_type).toBe('CREDENTIAL_ISSUED');
    });

    it('supports CREDENTIAL_VERIFIED event', async () => {
      const { privateKey } = await generateTestKeyPair();

      const receipt = await createReceipt(
        'CREDENTIAL_VERIFIED',
        { type: 'verifier', id: 'did:key:verifier-456' },
        { credential_id: 'cred-001', issuer_did: 'did:key:issuer-123' },
        'VALID',
        {},
        privateKey
      );

      expect(receipt.event_type).toBe('CREDENTIAL_VERIFIED');
    });

    it('supports CREDENTIAL_REVOKED event', async () => {
      const { privateKey } = await generateTestKeyPair();

      const receipt = await createReceipt(
        'CREDENTIAL_REVOKED',
        { type: 'issuer', id: 'did:key:issuer-123' },
        { credential_id: 'cred-001', issuer_did: 'did:key:issuer-123' },
        'REVOKED',
        {},
        privateKey
      );

      expect(receipt.event_type).toBe('CREDENTIAL_REVOKED');
    });
  });
});
