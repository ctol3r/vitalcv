// store.test.ts - Tests for the CredentialStore service

import { CredentialStore } from './store';

describe('CredentialStore', () => {
  let store: CredentialStore;

  beforeEach(() => {
    store = new CredentialStore();
  });

  describe('setStatus', () => {
    it('should throw an error when trying to set status for non-existent credential', () => {
      expect(() => {
        store.setStatus('non-existent-id', 'verified');
      }).toThrow("Credential with ID 'non-existent-id' not found");
    });

    it('should update status for existing credential', async () => {
      // Create a credential first
      const credential = store.createCredential('test-id', 'jwt-token', 'subject-123', 'pending');

      // Add a small delay to ensure updatedAt is different from createdAt
      await new Promise((resolve) => setTimeout(resolve, 1));

      // Update its status
      const updatedCredential = store.setStatus('test-id', 'verified');

      expect(updatedCredential.status).toBe('verified');
      expect(updatedCredential.updatedAt).toBeInstanceOf(Date);
      expect(updatedCredential.updatedAt.getTime()).toBeGreaterThan(credential.createdAt.getTime());
    });

    it('should not create incomplete records when ID is not found', () => {
      const initialCount = store.getAllCredentials().length;

      expect(() => {
        store.setStatus('non-existent-id', 'verified');
      }).toThrow();

      // Verify no incomplete record was created
      expect(store.getAllCredentials().length).toBe(initialCount);
    });
  });

  describe('createCredential', () => {
    it('should create a complete credential record with all required fields', () => {
      const credential = store.createCredential('test-id', 'jwt-token', 'subject-123', 'pending');

      expect(credential.id).toBe('test-id');
      expect(credential.jwt).toBe('jwt-token');
      expect(credential.subjectId).toBe('subject-123');
      expect(credential.status).toBe('pending');
      expect(credential.createdAt).toBeInstanceOf(Date);
      expect(credential.updatedAt).toBeInstanceOf(Date);
    });

    it('should use default status when not provided', () => {
      const credential = store.createCredential('test-id', 'jwt-token', 'subject-123');

      expect(credential.status).toBe('pending');
    });
  });

  describe('getCredential', () => {
    it('should return undefined for non-existent credential', () => {
      expect(store.getCredential('non-existent-id')).toBeUndefined();
    });

    it('should return the credential for existing ID', () => {
      const createdCredential = store.createCredential('test-id', 'jwt-token', 'subject-123');
      const retrievedCredential = store.getCredential('test-id');

      expect(retrievedCredential).toEqual(createdCredential);
    });
  });

  describe('getAllCredentials', () => {
    it('should return empty array when no credentials exist', () => {
      expect(store.getAllCredentials()).toEqual([]);
    });

    it('should return all created credentials', () => {
      const credential1 = store.createCredential('id1', 'jwt1', 'subject1');
      const credential2 = store.createCredential('id2', 'jwt2', 'subject2');

      const allCredentials = store.getAllCredentials();
      expect(allCredentials).toHaveLength(2);
      expect(allCredentials).toContain(credential1);
      expect(allCredentials).toContain(credential2);
    });
  });

  describe('deleteCredential', () => {
    it('should return false for non-existent credential', () => {
      expect(store.deleteCredential('non-existent-id')).toBe(false);
    });

    it('should return true and remove credential for existing ID', () => {
      store.createCredential('test-id', 'jwt-token', 'subject-123');

      expect(store.deleteCredential('test-id')).toBe(true);
      expect(store.getCredential('test-id')).toBeUndefined();
    });
  });
});
