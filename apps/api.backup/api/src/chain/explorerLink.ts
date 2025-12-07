/**
 * Block Explorer Link Generator
 * Task 201.26 - Generate explorer links for transactions
 */

export interface ExplorerConfig {
  baseUrl: string;
  txPath?: string;
  blockPath?: string;
  accountPath?: string;
}

const EXPLORER_CONFIGS: Record<string, ExplorerConfig> = {
  // Local development
  local: {
    baseUrl: 'http://localhost:3000',
    txPath: '/extrinsics',
    blockPath: '/blocks',
    accountPath: '/accounts',
  },

  // Polkadot
  polkadot: {
    baseUrl: 'https://polkadot.subscan.io',
    txPath: '/extrinsic',
    blockPath: '/block',
    accountPath: '/account',
  },

  // Kusama
  kusama: {
    baseUrl: 'https://kusama.subscan.io',
    txPath: '/extrinsic',
    blockPath: '/block',
    accountPath: '/account',
  },

  // VitalCV Chain (custom)
  vitalcv: {
    baseUrl: process.env.VITALCV_EXPLORER_URL || 'http://localhost:3000',
    txPath: '/tx',
    blockPath: '/block',
    accountPath: '/account',
  },
};

/**
 * Task 201.26 - Generate clickable explorer link for transaction
 */
export function generateTxLink(txHash: string, network: string = 'local'): string {
  const config = EXPLORER_CONFIGS[network] || EXPLORER_CONFIGS.local;
  const cleanHash = txHash.replace('0x', '');

  return `${config.baseUrl}${config.txPath}/${cleanHash}`;
}

/**
 * Generate block explorer link
 */
export function generateBlockLink(blockHash: string, network: string = 'local'): string {
  const config = EXPLORER_CONFIGS[network] || EXPLORER_CONFIGS.local;
  const cleanHash = blockHash.replace('0x', '');

  return `${config.baseUrl}${config.blockPath}/${cleanHash}`;
}

/**
 * Generate account explorer link
 */
export function generateAccountLink(accountId: string, network: string = 'local'): string {
  const config = EXPLORER_CONFIGS[network] || EXPLORER_CONFIGS.local;

  return `${config.baseUrl}${config.accountPath}/${accountId}`;
}

/**
 * Format anchor result with explorer links
 */
export function formatAnchorResultWithLinks(
  result: any,
  network: string = 'local'
): any {
  const formatted = { ...result };

  if (result.txHash) {
    formatted.explorerUrl = generateTxLink(result.txHash, network);
  }

  if (result.blockHash) {
    formatted.blockExplorerUrl = generateBlockLink(result.blockHash, network);
  }

  return formatted;
}

/**
 * Get network from environment
 */
export function getNetworkFromEnv(): string {
  const wsUrl = process.env.SUBSTRATE_WS_URL || '';

  if (wsUrl.includes('polkadot')) return 'polkadot';
  if (wsUrl.includes('kusama')) return 'kusama';
  if (wsUrl.includes('vitalcv')) return 'vitalcv';

  return 'local';
}

