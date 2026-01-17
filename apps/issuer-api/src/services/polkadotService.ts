export interface AuditRecord {
  userId: string;
  action: string;
  timestamp: number;
}

/**
 * Minimal chain wrapper used by issuer API flows.
 * Placeholder implementation mirrors the backend anchor behavior without a live client.
 */
export class PolkadotService {
  private static anchoredHashes = new Set<string>();

  async connect(): Promise<void> {
    if (process.env.CHAIN_DISABLED === 'true' || process.env.NODE_ENV === 'test') {
      return;
    }
    // Placeholder: issuer-api does not maintain a chain client.
  }

  async storeAuditRecord(record: AuditRecord): Promise<void> {
    console.log('Storing record on-chain:', record);
  }

  async anchorData(hash: string): Promise<string> {
    if (!hash || typeof hash !== 'string') {
      throw new Error('anchorData requires a hash string');
    }

    const normalized = hash.toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalized)) {
      throw new Error('anchorData requires a 64-character hex SHA-256 hash');
    }

    console.log('Anchoring data hash on-chain:', normalized);
    PolkadotService.anchoredHashes.add(normalized);
    return `0x${normalized.slice(0, 16)}`;
  }

  static hasAnchoredHash(hash: string): boolean {
    return PolkadotService.anchoredHashes.has(hash.toLowerCase());
  }

  static clearAnchoredHashes(): void {
    PolkadotService.anchoredHashes.clear();
  }
}
