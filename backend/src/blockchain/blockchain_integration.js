import { CrossChainDIDResolver } from './cross_chain_did_resolver.js';

/**
 * resolveDID provides a simple integration point for other parts of the backend
 * to fetch DID documents from external resolver networks.
 */
export async function resolveDID(did, resolverUrl) {
  const resolver = new CrossChainDIDResolver(resolverUrl);
  return resolver.resolve(did);
}
