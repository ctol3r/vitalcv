export class PolkadotService {
  private static anchoredHashes = new Set<string>();

  async anchorData(hash: string): Promise<string> {
    if (!hash || typeof hash !== 'string') {
      throw new Error('anchorData requires a hash string');
    }

    const normalized = hash.toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalized)) {
      throw new Error('anchorData requires a 64-character hex SHA-256 hash');
    }

    PolkadotService.anchoredHashes.add(normalized);
    return `0x${normalized.slice(0, 16)}`;
  }

  static hasAnchoredHash(hash: string): boolean {
    if (!hash) {
      return false;
    }
    return PolkadotService.anchoredHashes.has(hash.toLowerCase());
  }

  static clearAnchoredHashes(): void {
    PolkadotService.anchoredHashes.clear();
  }
}
