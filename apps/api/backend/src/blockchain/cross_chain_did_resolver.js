/**
 * CrossChainDIDResolver fetches DID documents from external resolver services.
 * The resolverBaseUrl should point to a service compatible with the
 * Universal Resolver API, e.g. https://uniresolver.io.
 */
export class CrossChainDIDResolver {
  constructor(resolverBaseUrl) {
    this.resolverBaseUrl = resolverBaseUrl;
  }

  async resolve(did) {
    const url = `${this.resolverBaseUrl}/1.0/identifiers/${encodeURIComponent(did)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch DID document: ${response.status} ${response.statusText}`);
    }
    const body = await response.json();
    return body.didDocument ?? body;
  }
}
