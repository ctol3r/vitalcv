/**
 * didResolver.ts — Wave 100: DID Resolution
 *
 * Resolves DIDs to their documents with caching and validation.
 * Supports local did:vitalcv DIDs and stubs for external methods
 * (did:web, did:key) that would be resolved via HTTP/crypto in prod.
 */

import { resolveDID, type DIDDocument } from './didRegistry';
import { fetchEntityConfiguration } from '../federation/federationMetadata';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────

export type DIDResolutionStatus = 'resolved' | 'not_found' | 'deactivated' | 'invalid' | 'unsupported_method';

export interface DIDResolutionResult {
  did: string;
  status: DIDResolutionStatus;
  document: DIDDocument | null;
  resolvedAt: string;
  method: string;
}

// ── Resolution cache ──────────────────────────────────────────────────

const cache = new Map<string, { result: DIDResolutionResult; cachedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function parseDIDMethod(did: string): string {
  const parts = did.split(':');
  return parts[1] ?? 'unknown';
}

function isValidDIDFormat(did: string): boolean {
  return /^did:[a-z]+:[a-zA-Z0-9._-]+:.+$/.test(did);
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Resolve a DID to its document.
 *
 * Local did:vitalcv DIDs are resolved from the in-memory registry.
 * External methods (did:web, did:key, etc.) are stubbed — in production
 * these would use Universal Resolver or method-specific resolution.
 */
export async function resolveDid(did: string): Promise<DIDResolutionResult> {
  const resolvedAt = new Date().toISOString();

  // Cache hit
  const cached = cache.get(did);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.result;
  }

  // Validate format
  if (!isValidDIDFormat(did)) {
    const result: DIDResolutionResult = {
      did,
      status: 'invalid',
      document: null,
      resolvedAt,
      method: 'unknown',
    };
    cache.set(did, { result, cachedAt: Date.now() });
    return result;
  }

  const method = parseDIDMethod(did);
  let result: DIDResolutionResult;

  if (method === 'vitalcv') {
    // Local resolution
    const doc = resolveDID(did);
    if (!doc) {
      result = { did, status: 'not_found', document: null, resolvedAt, method };
    } else if (doc.status !== 'ACTIVE') {
      result = { did, status: 'deactivated', document: doc, resolvedAt, method };
    } else {
      result = { did, status: 'resolved', document: doc, resolvedAt, method };
    }
  } else if (method === 'web') {
    // Wave 113: Try to resolve via OpenID Federation metadata cache
    // did:web:<domain> maps to https://<domain>/.well-known/openid-federation
    const domain = did.replace('did:web:', '').replace(/:/g, '/');
    const entityUrl = `https://${domain}`;
    const entityConfig = await fetchEntityConfiguration(entityUrl);
    if (entityConfig && entityConfig.trustVerified) {
      // Synthesize a DID document from federation entity metadata
      const federatedDoc: DIDDocument = {
        did,
        controller: did,
        publicKey: '', // Keys come from JWKS
        subjectType: 'issuer',
        label: entityConfig.configuration.metadata?.federation_entity?.['organization_name'] as string | undefined,
        createdAt: entityConfig.cachedAt,
        status: 'ACTIVE',
        serviceEndpoints: [{
          type: 'OpenIDFederation',
          endpoint: entityConfig.configuration.iss,
        }],
        metadata: { federated: true, entityId: entityConfig.entityId },
      };
      result = { did, status: 'resolved', document: federatedDoc, resolvedAt, method };
    } else {
      log('warn', 'did_web_no_federation_config', { did, entityUrl });
      result = {
        did,
        status: 'unsupported_method',
        document: null,
        resolvedAt,
        method,
      };
    }
  } else if (method === 'key' || method === 'peer') {
    // External method stub — would use Universal Resolver in production
    log('warn', 'did_external_method_stub', { did, method });
    result = {
      did,
      status: 'unsupported_method',
      document: null,
      resolvedAt,
      method,
    };
  } else {
    result = { did, status: 'unsupported_method', document: null, resolvedAt, method };
  }

  cache.set(did, { result, cachedAt: Date.now() });

  log('info', 'did_resolved', { did, status: result.status, method });
  return result;
}

/** Flush the resolution cache (useful for testing). */
export function flushDIDCache(): void {
  cache.clear();
}

/** Cache stats. */
export function didCacheSize(): number {
  return cache.size;
}
