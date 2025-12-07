import vault from 'node-vault';

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
  return path.replace(/^\/+/, '').trim();
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

  // Local/test fallback
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
      console.warn('[vaultClient] Vault read failed, falling back to env/local store', error);
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
import vault from 'node-vault';

export interface VaultClientConfig {
  endpoint?: string;
  kvMount?: string;
  token?: string;
}

export interface GetSecretOptions {
  /**
   * Specific field to return from the secret payload.
   * Defaults to `value` for compatibility with kv-v2 helpers.
   */
  field?: string;
  /**
   * Override the KV mount path (defaults to VAULT_KV_MOUNT or `secret`).
   */
  mount?: string;
}

export interface WriteSecretOptions {
  mount?: string;
}

export class VaultClientError extends Error {
  code: string;
  status?: number;
  details?: unknown;

  constructor(message: string, code: string, status = 500, details?: unknown) {
    super(message);
    this.name = 'VaultClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type NodeVaultClient = ReturnType<typeof vault>;

const DEFAULT_ENDPOINT =
  process.env.VAULT_ADDR ||
  process.env.VAULT_DEV_ADDR ||
  process.env.VAULT_ADDR_INTERNAL ||
  'http://127.0.0.1:8200';

const DEFAULT_KV_MOUNT = process.env.VAULT_KV_MOUNT || 'secret';

function sanitizePath(path: string): string {
  return path.replace(/^\/+/, '').replace(/\/+/g, '/');
}

export class VaultClient {
  private client: NodeVaultClient | null = null;
  private readonly endpoint: string;
  private readonly kvMount: string;
  private readonly token: string | null;

  constructor(config?: VaultClientConfig) {
    this.endpoint = config?.endpoint || DEFAULT_ENDPOINT;
    this.kvMount = config?.kvMount || DEFAULT_KV_MOUNT;
    this.token =
      config?.token ||
      process.env.VAULT_TOKEN ||
      process.env.VAULT_DEV_ROOT_TOKEN ||
      null;

    if (!process.env.VAULT_TOKEN && process.env.VAULT_DEV_ROOT_TOKEN && process.env.NODE_ENV === 'production') {
      console.warn(
        '[VaultClient] Using VAULT_DEV_ROOT_TOKEN in production is not allowed. Please configure service auth (K8s approle).'
      );
    }
  }

  isEnabled(): boolean {
    return Boolean(this.token);
  }

  private ensureClient(): NodeVaultClient {
    if (!this.token) {
      throw new VaultClientError(
        'Vault token is not configured. Set VAULT_TOKEN or VAULT_DEV_ROOT_TOKEN.',
        'VAULT_NOT_AUTHENTICATED',
        401
      );
    }

    if (!this.client) {
      this.client = vault({
        apiVersion: 'v1',
        endpoint: this.endpoint,
        token: this.token,
      });
    }

    return this.client;
  }

  private buildDataPath(path: string, mount?: string): string {
    const kvMount = mount || this.kvMount;
    return `${kvMount}/data/${sanitizePath(path)}`;
  }

  async getSecret<T = unknown>(path: string, options?: GetSecretOptions): Promise<T> {
    if (!this.isEnabled()) {
      throw new VaultClientError(
        'Vault is not configured for this process.',
        'VAULT_DISABLED',
        503
      );
    }

    const client = this.ensureClient();
    const secretPath = this.buildDataPath(path, options?.mount);

    try {
      const response = await client.read(secretPath);
      const payload = response?.data?.data;

      if (!payload) {
        throw new VaultClientError(
          `Secret ${path} returned empty payload`,
          'VAULT_SECRET_EMPTY',
          404
        );
      }

      if (options?.field) {
        if (!(options.field in payload)) {
          throw new VaultClientError(
            `Field ${options.field} missing in secret ${path}`,
            'VAULT_FIELD_NOT_FOUND',
            404
          );
        }
        return payload[options.field] as T;
      }

      if (Object.prototype.hasOwnProperty.call(payload, 'value')) {
        return payload.value as T;
      }

      return payload as T;
    } catch (error: any) {
      if (error instanceof VaultClientError) {
        throw error;
      }

      const statusCode = typeof error?.response?.statusCode === 'number'
        ? error.response.statusCode
        : 500;

      throw new VaultClientError(
        `Failed to read secret ${path}: ${error?.message || 'unknown error'}`,
        'VAULT_READ_FAILED',
        statusCode,
        { cause: error }
      );
    }
  }

  async setSecret(path: string, value: Record<string, unknown> | string, options?: WriteSecretOptions): Promise<void> {
    const client = this.ensureClient();
    const secretPath = this.buildDataPath(path, options?.mount);
    const payload =
      typeof value === 'object' && value !== null ? value : { value };

    try {
      await client.write(secretPath, { data: payload });
    } catch (error: any) {
      throw new VaultClientError(
        `Failed to write secret ${path}: ${error?.message || 'unknown error'}`,
        'VAULT_WRITE_FAILED',
        typeof error?.response?.statusCode === 'number' ? error.response.statusCode : 500,
        { cause: error }
      );
    }
  }

  async deleteSecret(path: string, options?: WriteSecretOptions): Promise<void> {
    const client = this.ensureClient();
    const secretPath = this.buildDataPath(path, options?.mount);

    try {
      await client.delete(secretPath);
    } catch (error: any) {
      throw new VaultClientError(
        `Failed to delete secret ${path}: ${error?.message || 'unknown error'}`,
        'VAULT_DELETE_FAILED',
        typeof error?.response?.statusCode === 'number' ? error.response.statusCode : 500,
        { cause: error }
      );
    }
  }
}

export const vaultClient = new VaultClient();

export const getSecret = vaultClient.getSecret.bind(vaultClient) as <T = unknown>(
  path: string,
  options?: GetSecretOptions
) => Promise<T>;

export const setSecret = vaultClient.setSecret.bind(vaultClient) as (
  path: string,
  value: Record<string, unknown> | string,
  options?: WriteSecretOptions
) => Promise<void>;

export const deleteSecret = vaultClient.deleteSecret.bind(vaultClient) as (
  path: string,
  options?: WriteSecretOptions
) => Promise<void>;

