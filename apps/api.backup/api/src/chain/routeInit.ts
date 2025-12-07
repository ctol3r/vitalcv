/**
 * Route Initialization Helper
 * Connects route modules with chain services
 */

import {
  getPolkadotService,
  getCredentialChainService,
  getTrustRegistryService,
  getChainHealthMonitor
} from './index';

import { initChainHealthRoute } from '../routes/chain_health';
import { initChainCredentialRoutes } from '../routes/chain_credential';
import { initChainIssuersRoute } from '../routes/chain_issuers';

/**
 * Initialize all chain routes with services
 */
export function initChainRoutes(): void {
  try {
    const polkadotService = getPolkadotService();
    const credentialService = getCredentialChainService();
    const trustRegistry = getTrustRegistryService();
    const healthMonitor = getChainHealthMonitor();

    initChainHealthRoute(polkadotService, healthMonitor);
    initChainCredentialRoutes(credentialService, trustRegistry);
    initChainIssuersRoute(trustRegistry);

    console.log('✅ Chain routes initialized');
  } catch (error) {
    console.error('❌ Failed to initialize chain routes:', error);
  }
}

export {
  initChainHealthRoute,
  initChainCredentialRoutes,
  initChainIssuersRoute
};

