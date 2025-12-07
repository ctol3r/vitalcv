import type { ValidatorNodeConfig } from './types';

const ENV_CONFIG = process.env.CHAIN_VALIDATOR_NODES;

const DEFAULT_VALIDATORS: ValidatorNodeConfig[] = [
  {
    id: 'validator-alpha',
    label: 'Alpha Validator',
    rpcUrl: process.env.VALIDATOR_ALPHA_RPC ?? process.env.SUBSTRATE_RPC_URL ?? 'http://localhost:9933',
    region: 'iad',
    priority: 1,
  },
  {
    id: 'validator-beta',
    label: 'Beta Validator',
    rpcUrl: process.env.VALIDATOR_BETA_RPC ?? 'http://localhost:9934',
    region: 'phx',
    priority: 2,
  },
  {
    id: 'validator-gamma',
    label: 'Gamma Validator',
    rpcUrl: process.env.VALIDATOR_GAMMA_RPC ?? 'http://localhost:9935',
    region: 'dub',
    priority: 3,
  },
];

export function resolveValidatorNodes(custom?: ValidatorNodeConfig[]): ValidatorNodeConfig[] {
  if (custom?.length) {
    return dedupeNodes(custom);
  }

  if (ENV_CONFIG) {
    try {
      const parsed = JSON.parse(ENV_CONFIG) as ValidatorNodeConfig[];
      if (Array.isArray(parsed) && parsed.length) {
        return dedupeNodes(
          parsed.map((entry, index) => ({
            id: entry.id ?? `validator-${index + 1}`,
            label: entry.label ?? entry.id ?? `Validator ${index + 1}`,
            rpcUrl: entry.rpcUrl,
            region: entry.region,
            priority: entry.priority ?? index + 1,
          })),
        );
      }
    } catch (error) {
      console.warn('[chain][health] Unable to parse CHAIN_VALIDATOR_NODES, falling back to defaults', error);
      const parsed = ENV_CONFIG.split(',').map((chunk, index) => {
        const [idOrLabel, url, region] = chunk.split('|');
        return {
          id: idOrLabel?.trim() || `validator-${index + 1}`,
          label: idOrLabel?.trim() || `Validator ${index + 1}`,
          rpcUrl: (url ?? process.env.SUBSTRATE_RPC_URL ?? 'http://localhost:9933').trim(),
          region: region?.trim(),
          priority: index + 1,
        };
      });
      if (parsed.length) {
        return dedupeNodes(parsed);
      }
    }
  }

  return dedupeNodes(DEFAULT_VALIDATORS);
}

function dedupeNodes(nodes: ValidatorNodeConfig[]): ValidatorNodeConfig[] {
  const seen = new Set<string>();
  return nodes
    .filter((node) => {
      if (!node.rpcUrl) return false;
      if (seen.has(node.id)) return false;
      seen.add(node.id);
      return true;
    })
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
}









