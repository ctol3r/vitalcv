export interface PsvArtifact {
  artifactId: string;
  npi: string;
  source: string;
  sourceUrl: string;
  endpointMetadata: {
    version: string;
    retrievedAt: string;
    responseTimeMs: number;
  };
  retrievalTimestampUtc: string;
  rawPayload: string;
  checksum: string;
  rawChecksum: string;
  normalizedData: Record<string, unknown>;
  methodologyVersion: string;
  verifierIdentity: string;
  status: 'ACTIVE' | 'EXPIRED' | 'NOT_FOUND' | 'ERROR';
  licenseNumber?: string;
  state?: string;
  expiresAt?: string;
}

export interface PsvAdapterConfig {
  sourceId: string;
  sourceDisplayName: string;
  methodologyVersion: string;
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  retryAttempts: number;
}

export interface IPsvAdapter {
  config: PsvAdapterConfig;
  fetchArtifact(npi: string, opts?: Record<string, unknown>): Promise<PsvArtifact>;
  supports(npi: string): boolean;
}
