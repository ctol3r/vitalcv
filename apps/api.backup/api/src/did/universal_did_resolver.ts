import { Resolver } from 'did-resolver';
import { getResolver as getWebResolver } from 'web-did-resolver';
import { getResolver as getEthrResolver } from 'ethr-did-resolver';
import { getResolver as getKeyResolver } from 'key-did-resolver';

export interface UniversalResolverOptions {
  /**
   * Options passed to ethr-did-resolver. You can specify networks or an Infura
   * project id. If omitted, did:ethr resolution will be disabled.
   */
  ethr?: {
    infuraProjectId?: string;
    networks?: Array<{ name?: string; chainId?: number | string; rpcUrl?: string }>;
  };
}

/**
 * UniversalDIDResolver wraps did-resolver with support for did:web, did:ethr,
 * and did:key methods.
 */
export class UniversalDIDResolver {
  private resolver: Resolver;

  constructor(options: UniversalResolverOptions = {}) {
    const methodResolvers: Record<string, any> = {
      ...getWebResolver(),
      ...getKeyResolver(),
    };

    if (options.ethr && (options.ethr.infuraProjectId || options.ethr.networks)) {
      Object.assign(methodResolvers, getEthrResolver(options.ethr));
    }

    this.resolver = new Resolver(methodResolvers);
  }

  /**
   * Resolve a DID and return its DID Document.
   * @param did - The decentralized identifier to resolve.
   */
  async resolve(did: string): Promise<any> {
    return this.resolver.resolve(did);
  }
}

// If an INFURA_PROJECT_ID environment variable is present, enable did:ethr
// resolution using Infura for mainnet and common testnets.
export const defaultResolver = new UniversalDIDResolver(
  process.env.INFURA_PROJECT_ID ? { ethr: { infuraProjectId: process.env.INFURA_PROJECT_ID } } : {}
);
