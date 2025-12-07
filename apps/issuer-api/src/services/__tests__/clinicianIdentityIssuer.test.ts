/**
 * S72-D1-A-007: Unit tests for ClinicianIdentityVC Issuer
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { generateKeyPair, exportJWK } from 'jose';
import {
  issueClinicianIdentityVC,
  verifyClinicianIdentityVC,
  getPublicJWK,
  ClinicianProfile,
} from '../clinicianIdentityIssuer';
import { resetSigningKeyCache } from '../../../../../services/identity/signingKeyProvider';

beforeAll(async () => {
  if (!process.env.VC_SIGNING_KEY_JWK) {
    const { privateKey } = await generateKeyPair('EdDSA');
    const jwk = await exportJWK(privateKey);
    jwk.kid = 'test-issuer-key';
    process.env.VC_SIGNING_KEY_JWK = JSON.stringify(jwk);
  }
  resetSigningKeyCache();
});

describe('ClinicianIdentityVC Issuer', () => {
  describe('issueClinicianIdentityVC', () => {
    it('should issue a valid ClinicianIdentityVC', async () => {
      const profile: ClinicianProfile = {
        name: 'Dr. Jane Smith',
        npi: '1234567890',
        specialty: 'Cardiology',
      };

      const vcJws = await issueClinicianIdentityVC(profile);

      expect(vcJws).toBeTruthy();
      expect(typeof vcJws).toBe('string');
      expect(vcJws.split('.')).toHaveLength(3); // Valid JWS format
    });

    it('should include correct credential subject data', async () => {
      const profile: ClinicianProfile = {
        name: 'Dr. John Doe',
        npi: '9876543210',
        specialty: 'Neurology',
      };

      const vcJws = await issueClinicianIdentityVC(profile);
      const vc = await verifyClinicianIdentityVC(vcJws);

      expect(vc.credentialSubject.name).toBe('Dr. John Doe');
      expect(vc.credentialSubject.npi).toBe('9876543210');
      expect(vc.credentialSubject.specialty).toBe('Neurology');
    });

    it('should reject invalid NPI', async () => {
      const profile: ClinicianProfile = {
        name: 'Dr. Jane Smith',
        npi: '123', // Invalid: not 10 digits
        specialty: 'Cardiology',
      };

      await expect(issueClinicianIdentityVC(profile)).rejects.toThrow('Valid 10-digit NPI is required');
    });

    it('should reject missing name', async () => {
      const profile: ClinicianProfile = {
        name: '',
        npi: '1234567890',
        specialty: 'Cardiology',
      };

      await expect(issueClinicianIdentityVC(profile)).rejects.toThrow('Clinician name is required');
    });

    it('should reject missing specialty', async () => {
      const profile: ClinicianProfile = {
        name: 'Dr. Jane Smith',
        npi: '1234567890',
        specialty: '',
      };

      await expect(issueClinicianIdentityVC(profile)).rejects.toThrow('Clinician specialty is required');
    });

    it('should use provided DID if available', async () => {
      const profile: ClinicianProfile = {
        did: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        name: 'Dr. Jane Smith',
        npi: '1234567890',
        specialty: 'Cardiology',
      };

      const vcJws = await issueClinicianIdentityVC(profile);
      const vc = await verifyClinicianIdentityVC(vcJws);

      expect(vc.credentialSubject.id).toBe('did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK');
    });
  });

  describe('verifyClinicianIdentityVC', () => {
    it('should verify a valid VC signature', async () => {
      const profile: ClinicianProfile = {
        name: 'Dr. Test',
        npi: '1111111111',
        specialty: 'Testing',
      };

      const vcJws = await issueClinicianIdentityVC(profile);
      const vc = await verifyClinicianIdentityVC(vcJws);

      expect(vc).toBeTruthy();
      expect(vc.type).toContain('VerifiableCredential');
      expect(vc.type).toContain('ClinicianIdentityCredential');
    });

    it('should reject invalid signature', async () => {
      const invalidJws = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSJdLCJpZCI6Imh0dHBzOi8vdml0YWxjdi5haS9jcmVkZW50aWFscy9jbGluaWNpYW4vdGVzdCIsInR5cGUiOlsiVmVyaWZpYWJsZUNyZWRlbnRpYWwiLCJDbGluaWNpYW5JZGVudGl0eUNyZWRlbnRpYWwiXX19.invalid';

      await expect(verifyClinicianIdentityVC(invalidJws)).rejects.toThrow();
    });
  });

  describe('getPublicJWK', () => {
    it('should return public JWK without private key', async () => {
      const publicJwk = await getPublicJWK();

      expect(publicJwk).toBeTruthy();
      expect(publicJwk.kty).toBeTruthy();
      expect(publicJwk.d).toBeUndefined(); // Private key component should be removed
    });
  });

  describe('VC structure', () => {
    it('should generate VC with correct context', async () => {
      const profile: ClinicianProfile = {
        name: 'Dr. Test',
        npi: '1234567890',
        specialty: 'Testing',
      };

      const vcJws = await issueClinicianIdentityVC(profile);
      const vc = await verifyClinicianIdentityVC(vcJws);

      expect(vc['@context']).toContain('https://www.w3.org/2018/credentials/v1');
    });

    it('should include issuanceDate', async () => {
      const profile: ClinicianProfile = {
        name: 'Dr. Test',
        npi: '1234567890',
        specialty: 'Testing',
      };

      const vcJws = await issueClinicianIdentityVC(profile);
      const vc = await verifyClinicianIdentityVC(vcJws);

      expect(vc.issuanceDate).toBeTruthy();
      expect(new Date(vc.issuanceDate).getTime()).toBeGreaterThan(0);
    });

    it('should have unique credential IDs', async () => {
      const profile: ClinicianProfile = {
        name: 'Dr. Test',
        npi: '1234567890',
        specialty: 'Testing',
      };

      const vc1Jws = await issueClinicianIdentityVC(profile);
      const vc2Jws = await issueClinicianIdentityVC(profile);

      const vc1 = await verifyClinicianIdentityVC(vc1Jws);
      const vc2 = await verifyClinicianIdentityVC(vc2Jws);

      expect(vc1.id).not.toBe(vc2.id);
    });
  });
});

