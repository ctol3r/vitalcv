/**
 * Chain Module Index
 * Task 201.5 - Startup connection logic
 *
 * Central export point for all chain services
 */

import { getConfig } from '../config';
import { PolkadotService } from './PolkadotService';
import { CredentialChainService } from './CredentialChainService';
import { TrustRegistryService } from './TrustRegistryService';
import { ChainEventListener } from './eventListener';
import { ChainHealthMonitor } from './healthMonitor';
import {
  updateConnectionStatus,
  updateBlockHeight,
  updatePeers
} from './metrics';

// Global instances
let polkadotService: PolkadotService | null = null;
let credentialChainService: CredentialChainService | null = null;
let trustRegistryService: TrustRegistryService | null = null;
let eventListener: ChainEventListener | null = null;
let healthMonitor: ChainHealthMonitor | null = null;

/**
 * Task 201.5 - Initialize chain services
 */
export async function initializeChainServices(): Promise<void> {
  const config = getConfig();

  if (!config.substrate.enabled) {
    console.log('⏭️  Substrate chain integration disabled');
    return;
  }

  console.log('🔗 Initializing Substrate chain services...');

  try {
    // Initialize PolkadotService
    polkadotService = PolkadotService.getInstance({
      wsUrl: config.substrate.wsUrl,
      retryAttempts: config.substrate.retryAttempts,
      retryDelay: config.substrate.retryDelay,
      maxRetryDelay: config.substrate.maxRetryDelay,
      reconnectOnDisconnect: true,
    });

    // Connect to chain
    await polkadotService.connect();
    updateConnectionStatus(true);

    // Initialize other services
    credentialChainService = new CredentialChainService(polkadotService);
    trustRegistryService = new TrustRegistryService(polkadotService);
    eventListener = new ChainEventListener(polkadotService);
    healthMonitor = new ChainHealthMonitor(polkadotService);

    // Run startup checks (Tasks 201.40, 201.41)
    const checksPass = await healthMonitor.runStartupChecks();

    if (!checksPass) {
      console.warn('⚠️  Some startup checks failed, but continuing...');
    }

    // Start event listener
    await eventListener.startListening();

    // Setup default event handlers
    setupDefaultEventHandlers();

    // Start health monitoring (Task 201.32)
    healthMonitor.startHeartbeat(30000); // 30 seconds

    // Update metrics
    const health = await healthMonitor.checkHealth();
    updateBlockHeight(health.blockNumber);
    updatePeers(health.peers);

    console.log('✅ Chain services initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize chain services:', error);
    updateConnectionStatus(false);

    // Don't throw - allow API to start even if chain is unavailable
    console.warn('⚠️  API starting without chain integration');
  }
}

/**
 * Setup default event handlers
 * Tasks 201.20, 201.21
 */
function setupDefaultEventHandlers(): void {
  if (!eventListener) return;

  // Log all credential events
  eventListener.onCredentialIssued((event) => {
    console.log('📜 CredentialIssued:', event.data);
    // TODO: Store in audit log
  });

  eventListener.onCredentialRevoked((event) => {
    console.log('🚫 CredentialRevoked:', event.data);
    // TODO: Update DB status
  });

  // Track metrics for all events
  eventListener.on('*', (event) => {
    // Update metrics
    if (event.blockNumber) {
      updateBlockHeight(event.blockNumber);
    }
  });
}

/**
 * Get PolkadotService instance
 */
export function getPolkadotService(): PolkadotService {
  if (!polkadotService) {
    throw new Error('PolkadotService not initialized. Call initializeChainServices() first.');
  }
  return polkadotService;
}

/**
 * Get CredentialChainService instance
 */
export function getCredentialChainService(): CredentialChainService {
  if (!credentialChainService) {
    throw new Error('CredentialChainService not initialized');
  }
  return credentialChainService;
}

/**
 * Get TrustRegistryService instance
 */
export function getTrustRegistryService(): TrustRegistryService {
  if (!trustRegistryService) {
    throw new Error('TrustRegistryService not initialized');
  }
  return trustRegistryService;
}

/**
 * Get ChainEventListener instance
 */
export function getChainEventListener(): ChainEventListener {
  if (!eventListener) {
    throw new Error('ChainEventListener not initialized');
  }
  return eventListener;
}

/**
 * Get ChainHealthMonitor instance
 */
export function getChainHealthMonitor(): ChainHealthMonitor {
  if (!healthMonitor) {
    throw new Error('ChainHealthMonitor not initialized');
  }
  return healthMonitor;
}

/**
 * Shutdown chain services
 */
export async function shutdownChainServices(): Promise<void> {
  console.log('🔌 Shutting down chain services...');

  if (healthMonitor) {
    healthMonitor.stopHeartbeat();
  }

  if (eventListener) {
    eventListener.stopListening();
  }

  if (polkadotService) {
    await polkadotService.disconnect();
    updateConnectionStatus(false);
  }

  console.log('✅ Chain services shut down');
}

// Export services
export {
  PolkadotService,
  CredentialChainService,
  TrustRegistryService,
  ChainEventListener,
  ChainHealthMonitor,
};

// Export types
export * from './types';
export * from './hashBuilder';
export * from './errorNormalizer';

