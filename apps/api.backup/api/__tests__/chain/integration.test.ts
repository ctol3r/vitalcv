/**
 * Chain Integration Tests
 * Tasks 201.45, 201.46, 201.47
 */

import { PolkadotService } from '../../src/chain/PolkadotService';
import { CredentialChainService } from '../../src/chain/CredentialChainService';
import { buildDataHash } from '../../src/chain/hashBuilder';

describe('Chain Integration Tests', () => {
  let polkadotService: PolkadotService;
  let credentialService: CredentialChainService;

  beforeAll(async () => {
    // Only run tests if chain is available
    const wsUrl = process.env.SUBSTRATE_WS_URL || 'ws://localhost:9944';

    polkadotService = PolkadotService.getInstance({
      wsUrl,
      retryAttempts: 3,
      retryDelay: 1000,
      maxRetryDelay: 5000,
    });

    try {
      await polkadotService.connect();
      credentialService = new CredentialChainService(polkadotService);
    } catch (error) {
      console.warn('⚠️  Chain not available, skipping integration tests');
    }
  });

  afterAll(async () => {
    if (polkadotService) {
      await polkadotService.disconnect();
    }
  });

  /**
   * Task 201.45 - Integration test: issuance with anchoring
   */
  describe('Task 201.45 - Issuance with Anchoring', () => {
    it('should anchor credential and verify', async () => {
      if (!polkadotService.isConnected()) {
        console.warn('Skipping test - chain not connected');
        return;
      }

      if (!credentialService.canSign()) {
        console.warn('Skipping test - no signing key');
        return;
      }

      const credentialId = `test-${Date.now()}`;
      const hash = buildDataHash({ test: 'data' });
      const issuerDid = 'did:test:issuer';

      // Anchor credential
      const anchorResult = await credentialService.anchorCredential({
        credentialId,
        hash,
        issuerDid,
      });

      expect(anchorResult.success).toBe(true);
      expect(anchorResult.txHash).toBeDefined();

      // Wait for finalization
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify credential status
      const status = await credentialService.getCredentialStatus(credentialId);
      expect(status).toBeDefined();
      expect(status?.status).toBe('active');
    });
  });

  /**
   * Task 201.46 - Integration test: stale/failing chain
   */
  describe('Task 201.46 - Stale/Failing Chain', () => {
    it('should handle connection drop gracefully', async () => {
      // Test with invalid URL
      const badService = PolkadotService.getInstance({
        wsUrl: 'ws://invalid-host:9944',
        retryAttempts: 1,
        retryDelay: 100,
        maxRetryDelay: 1000,
      });

      await expect(badService.connect()).rejects.toThrow();
      expect(badService.isConnected()).toBe(false);
    });

    it('should not crash API when chain is unavailable', async () => {
      const service = new CredentialChainService(polkadotService);

      // Even if chain is down, these should not crash
      const status = await service.getCredentialStatus('nonexistent');
      expect(status).toBeNull();
    });
  });

  /**
   * Task 201.47 - Integration test: revoked on-chain
   */
  describe('Task 201.47 - Revoked Credential', () => {
    it('should issue, revoke, and verify revocation', async () => {
      if (!polkadotService.isConnected() || !credentialService.canSign()) {
        console.warn('Skipping test - chain not ready');
        return;
      }

      const credentialId = `revoke-test-${Date.now()}`;
      const hash = buildDataHash({ test: 'revocation' });
      const issuerDid = 'did:test:issuer';

      // Issue credential
      const issueResult = await credentialService.anchorCredential({
        credentialId,
        hash,
        issuerDid,
      });

      expect(issueResult.success).toBe(true);

      // Wait for finalization
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Revoke credential
      const revokeResult = await credentialService.revokeCredential(
        credentialId,
        'Test revocation'
      );

      expect(revokeResult.success).toBe(true);

      // Wait for finalization
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify revoked status
      const status = await credentialService.getCredentialStatus(credentialId);
      expect(status).toBeDefined();
      expect(status?.status).toBe('revoked');
    });
  });

  describe('Health and Connectivity', () => {
    it('should report connection status', () => {
      if (polkadotService) {
        const isConnected = polkadotService.isConnected();
        expect(typeof isConnected).toBe('boolean');
      }
    });

    it('should retrieve chain metadata', () => {
      if (polkadotService && polkadotService.isConnected()) {
        const metadata = polkadotService.getMetadata();
        expect(metadata).toBeDefined();
        expect(metadata?.chainName).toBeDefined();
      }
    });
  });
});

