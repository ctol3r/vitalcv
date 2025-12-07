import vault from 'node-vault';
import { getServiceLogger } from '../logging/serviceLogger';
const log = getServiceLogger('security/vaultClient');

type VaultInstance = ReturnType<typeof vault> | null;

const hasVaultEnv = Boolean(process.env.VAULT_ADDR && process.env.VAULT_TOKEN);
const vaultClient: VaultInstance = hasVaultEnv
  ? vault({
      endpoint: process.env.VAULT_ADDR as string,
      token: process.env.VAULT_TOKEN as string,
    })
  : null;

const fallbackStore = new Map<string, string>();

function normalizePath(path: string): string {
  return path.replace(/^\/+/g, '').trim();
}

export async function writeSecret(path: string, value: string): Promise<void> {
  const normalized = normalizePath(path);

  if (!normalized) {
    throw new Error('Secret path cannot be empty');
  }

  if (vaultClient) {
    await vaultClient.write(`secret/data/${normalized}`, {
      data: { value },
    });
    return;
  }

  fallbackStore.set(normalized, value);
  process.env[normalized] = value;
}

export async function readSecret(path: string): Promise<string> {
  const normalized = normalizePath(path);

  if (!normalized) {
    throw new Error('Secret path cannot be empty');
  }

  if (vaultClient) {
    try {
      const response = await vaultClient.read(`secret/data/${normalized}`);
      const value = response?.data?.data?.value;
      if (typeof value === 'string') {
        return value;
      }
    } catch (error) {
      log.warn('[vaultClient] Vault read failed, using fallback store', error);
    }
  }

  if (fallbackStore.has(normalized)) {
    return fallbackStore.get(normalized) as string;
  }

  const envValue = process.env[normalized];
  if (typeof envValue === 'string' && envValue.length > 0) {
    return envValue;
  }

  throw new Error(`Secret not found for path: ${normalized}`);
}
