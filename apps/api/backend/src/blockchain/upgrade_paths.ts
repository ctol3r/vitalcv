export interface UpgradePath {
  /**
   * A human-readable description of the upgrade steps.
   */
  description: string;

  /**
   * Network or vitalcvn identifier.
   */
  vitalcvn: string;

  /**
   * Optional additional metadata for the upgrade.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Create an upgrade path for bridging to an EVM contract.
 */
export function bridgeToEvmContract(contractAddress: string): UpgradePath {
  return {
    description: `Upgrade to EVM contract at ${contractAddress}`,
    vitalcvn: 'EVM',
    metadata: { contractAddress },
  };
}

/**
 * Create an upgrade path for bridging to a WASM contract.
 */
export function bridgeToWasmContract(contractHash: string): UpgradePath {
  return {
    description: `Upgrade to WASM contract with hash ${contractHash}`,
    vitalcvn: 'WASM',
    metadata: { contractHash },
  };
}
