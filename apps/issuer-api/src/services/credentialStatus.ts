import type { CredentialLifecycleState } from '../../../../types/credentialLifecycle';

type CredentialStatusResponse = {
  lifecycleState: string;
  revoked: boolean;
  suspended: boolean;
  expired: boolean;
};

type CredentialStatusState = {
  lifecycleState: CredentialLifecycleState;
  revoked: boolean;
  suspended: boolean;
  expired: boolean;
};

function parseBoolean(value: unknown): boolean {
  return value === true;
}

function parseString(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function parseStringPayload(value: unknown, field: string): string {
  const parsed = parseString(value);
  if (!parsed) {
    throw new Error(`${field} must be present and non-empty.`);
  }
  return parsed;
}

function normalizeLifecycleState(input: unknown): CredentialLifecycleState {
  const state = parseString(input).toLowerCase();
  switch (state) {
    case CredentialLifecycleState.ISSUED:
      return CredentialLifecycleState.ISSUED;
    case CredentialLifecycleState.ACTIVE:
      return CredentialLifecycleState.ACTIVE;
    case CredentialLifecycleState.SUSPENDED:
      return CredentialLifecycleState.SUSPENDED;
    case CredentialLifecycleState.REVOKED:
      return CredentialLifecycleState.REVOKED;
    case CredentialLifecycleState.EXPIRED:
      return CredentialLifecycleState.EXPIRED;
    default:
      throw new Error(`Unknown credential lifecycle state: ${state || 'empty'}.`);
  }
}

function resolveCredentialStatusBaseUrl(): string {
  const configured = parseString(process.env.CREDENTIAL_STATUS_BASE_URL);
  if (configured) {
    return configured.endsWith('/') ? configured.slice(0, -1) : configured;
  }
  return 'https://vitalcv.com';
}

export function credentialStatusUrl(artifactId: string): string {
  const normalizedArtifactId = parseStringPayload(artifactId, 'artifactId');
  return `${resolveCredentialStatusBaseUrl()}/api/credential-status/${normalizedArtifactId}`;
}

export function parseCredentialStatusArtifactId(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null;
  }

  const value = input.trim();
  if (!value) {
    return null;
  }

  const marker = '/api/credential-status/';
  let identifier = '';

  try {
    if (value.includes('://')) {
      const parsed = new URL(value);
      const markerIndex = parsed.pathname.lastIndexOf(marker);
      if (markerIndex === -1) {
        return null;
      }
      identifier = parsed.pathname.slice(markerIndex + marker.length);
    } else {
      const markerIndex = value.lastIndexOf(marker);
      if (markerIndex === -1) {
        return null;
      }
      identifier = value.slice(markerIndex + marker.length);
    }
  } catch {
    return null;
  }

  if (!identifier) {
    return null;
  }

  const normalized = identifier.split('?')[0].split('#')[0].trim();
  return normalized.length > 0 ? normalized : null;
}

export async function getCredentialLifecycleState(artifactId: string): Promise<CredentialStatusState> {
  const normalizedArtifactId = parseStringPayload(artifactId, 'artifactId');
  const endpoint = credentialStatusUrl(normalizedArtifactId);
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to verify credential lifecycle: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as CredentialStatusResponse;
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid credential status payload.');
  }

  const lifecycleState = normalizeLifecycleState((payload as { lifecycleState?: unknown }).lifecycleState);

  return {
    lifecycleState,
    revoked: parseBoolean((payload as { revoked?: unknown }).revoked),
    suspended: parseBoolean((payload as { suspended?: unknown }).suspended),
    expired: parseBoolean((payload as { expired?: unknown }).expired),
  };
}

export async function assertActiveCredentialLifecycle(artifactId: string): Promise<CredentialLifecycleState> {
  const status = await getCredentialLifecycleState(artifactId);

  if (status.lifecycleState === CredentialLifecycleState.REVOKED) {
    throw new Error('Credential lifecycle is revoked.');
  }

  if (status.lifecycleState === CredentialLifecycleState.EXPIRED) {
    throw new Error('Credential lifecycle is expired.');
  }

  if (status.lifecycleState !== CredentialLifecycleState.ACTIVE) {
    throw new Error(`Credential lifecycle is ${status.lifecycleState}.`);
  }

  return status.lifecycleState;
}

