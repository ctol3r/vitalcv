import fs from 'fs';
import path from 'path';

export type CredentialStatus = 'active' | 'revoked';

export interface StatusRegistryResult {
  status: CredentialStatus;
  revoked: boolean;
  source: 'local' | 'substrate' | 'local+substrate' | 'none';
  reason?: string;
  revokedAt?: string;
}

interface LocalStatusEntry {
  revoked: boolean;
  reason?: string;
  revokedAt?: string;
}

const localRegistry = new Map<string, LocalStatusEntry>();

function loadLocalRegistryFromEnv(): void {
  const registryPath = process.env.LOCAL_REVOCATION_REGISTRY_PATH;
  const registryJson = process.env.LOCAL_REVOCATION_REGISTRY;

  let raw: string | undefined;
  if (registryPath) {
    const resolved = path.resolve(registryPath);
    if (fs.existsSync(resolved)) {
      raw = fs.readFileSync(resolved, 'utf8');
    }
  } else if (registryJson) {
    raw = registryJson;
  }

  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      parsed.forEach((entry) => {
        if (entry?.credentialId) {
          localRegistry.set(entry.credentialId, {
            revoked: Boolean(entry.revoked),
            reason: entry.reason,
            revokedAt: entry.revokedAt,
          });
        }
      });
      return;
    }

    if (parsed && typeof parsed === 'object') {
      Object.entries(parsed).forEach(([credentialId, entry]) => {
        if (!entry || typeof entry !== 'object') return;
        const data = entry as LocalStatusEntry;
        localRegistry.set(credentialId, {
          revoked: Boolean(data.revoked),
          reason: data.reason,
          revokedAt: data.revokedAt,
        });
      });
    }
  } catch (error) {
    console.warn('[StatusRegistry] Failed to parse local registry:', error);
  }
}

loadLocalRegistryFromEnv();

export function setLocalCredentialStatus(credentialId: string, entry: LocalStatusEntry): void {
  localRegistry.set(credentialId, {
    revoked: Boolean(entry.revoked),
    reason: entry.reason,
    revokedAt: entry.revokedAt,
  });
}

function getLocalCredentialStatus(credentialId: string): LocalStatusEntry | null {
  return localRegistry.get(credentialId) || null;
}

async function checkSubstrateStatus(credentialId: string): Promise<LocalStatusEntry | null> {
  const baseUrl = process.env.SUBSTRATE_STATUS_URL;
  if (!baseUrl) {
    return null;
  }

  const url = baseUrl.includes('{credentialId}')
    ? baseUrl.replace('{credentialId}', encodeURIComponent(credentialId))
    : `${baseUrl.replace(/\/$/, '')}/status/${encodeURIComponent(credentialId)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      revoked: data.revoked === true || data.status === 'revoked',
      reason: data.reason,
      revokedAt: data.revokedAt || data.revoked_at,
    };
  } catch (error) {
    console.warn('[StatusRegistry] Substrate status check failed:', error);
    return null;
  }
}

export async function resolveCredentialStatus(credentialId: string): Promise<StatusRegistryResult> {
  const local = getLocalCredentialStatus(credentialId);
  const substrate = await checkSubstrateStatus(credentialId);

  const revoked = Boolean(local?.revoked || substrate?.revoked);
  const status: CredentialStatus = revoked ? 'revoked' : 'active';

  let source: StatusRegistryResult['source'] = 'none';
  if (local && substrate) {
    source = 'local+substrate';
  } else if (local) {
    source = 'local';
  } else if (substrate) {
    source = 'substrate';
  }

  return {
    status,
    revoked,
    source,
    reason: local?.reason || substrate?.reason,
    revokedAt: local?.revokedAt || substrate?.revokedAt,
  };
}

