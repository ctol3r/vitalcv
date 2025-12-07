export interface UpgradePath {
  /**
   * A human-readable description of the upgrade steps.
   */
  description: string;

  /**
   * Network or chain identifier.
   */
  chain: string;

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
    chain: 'EVM',
    metadata: { contractAddress },
  };
}

/**
 * Create an upgrade path for bridging to a WASM contract.
 */
export function bridgeToWasmContract(contractHash: string): UpgradePath {
  return {
    description: `Upgrade to WASM contract with hash ${contractHash}`,
    chain: 'WASM',
    metadata: { contractHash },
  };
}
