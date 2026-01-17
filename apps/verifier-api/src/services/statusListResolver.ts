export type CredentialStatusState = 'active' | 'revoked' | 'uncheckable';

export interface CredentialStatusResolution {
  status: CredentialStatusState;
  reason?: string;
  statusUrl?: string;
  listId?: string;
  index?: number;
  listUrl?: string;
}

interface StatusListPointer {
  listUrl?: string;
  statusUrl?: string;
  listId?: string;
  index: number;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function parseIndex(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return null;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

function buildStatusListUrl(baseUrl: string, listId?: string): string {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!listId) {
    return normalized;
  }
  const encoded = encodeURIComponent(listId);
  if (normalized.endsWith(`/${encoded}`)) {
    return normalized;
  }
  return `${normalized}/${encoded}`;
}

function extractStatusListPointer(vc: Record<string, unknown>): StatusListPointer | null {
  const statusValue = (vc.credentialStatus ?? vc.status) as unknown;
  if (!statusValue) {
    return null;
  }

  if (typeof statusValue === 'string') {
    const [listUrl, fragment] = statusValue.split('#');
    const index = parseIndex(fragment);
    if (index === null || !listUrl) {
      return null;
    }
    return { listUrl, index };
  }

  if (typeof statusValue !== 'object') {
    return null;
  }

  const status = statusValue as Record<string, unknown>;
  const statusList = status.status_list as Record<string, unknown> | undefined;

  const statusUrl = asString(
    status.statusUrl ?? status.status_url ?? statusList?.uri ?? statusList?.url,
  );
  const listId = asString(status.listId ?? status.list_id ?? statusList?.list_id);
  const statusListCredential = asString(
    status.statusListCredential ?? status.status_list_credential ?? statusList?.uri,
  );
  const idValue = asString(status.id);

  const index = parseIndex(
    status.statusListIndex ??
      status.status_list_index ??
      status.index ??
      status.idx ??
      statusList?.idx ??
      statusList?.index,
  );

  if (index === null) {
    return null;
  }

  if (statusListCredential) {
    return { listUrl: statusListCredential, statusUrl, listId, index };
  }

  if (idValue && idValue.includes('#')) {
    const [listUrl] = idValue.split('#');
    if (listUrl) {
      return { listUrl, statusUrl, listId, index };
    }
  }

  if (statusUrl) {
    return { listUrl: buildStatusListUrl(statusUrl, listId), statusUrl, listId, index };
  }

  return { listUrl: undefined, statusUrl, listId, index };
}

function decodeBase64Url(encoded: string): Buffer | null {
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padding);
    return Buffer.from(padded, 'base64');
  } catch {
    return null;
  }
}

function isIndexRevoked(encodedList: string, index: number): boolean | null {
  const bytes = decodeBase64Url(encodedList);
  if (!bytes) {
    return null;
  }

  const byteIndex = Math.floor(index / 8);
  if (byteIndex < 0 || byteIndex >= bytes.length) {
    return null;
  }

  const bitIndex = index % 8;
  const mask = 1 << (7 - bitIndex);
  return (bytes[byteIndex] & mask) !== 0;
}

function extractEncodedList(payload: Record<string, unknown>): string | null {
  const direct =
    asString(payload.encoded_list) || asString(payload.encodedList) || asString(payload.bitstring);
  if (direct) {
    return direct;
  }

  const statusList = payload.status_list as Record<string, unknown> | undefined;
  const statusListValue = statusList
    ? asString(statusList.encoded_list) ||
      asString(statusList.encodedList) ||
      asString(statusList.bits)
    : undefined;
  if (statusListValue) {
    return statusListValue;
  }

  const credentialSubject = payload.credentialSubject as Record<string, unknown> | undefined;
  if (credentialSubject) {
    const encodedList =
      asString(credentialSubject.encodedList) ?? asString(credentialSubject.encoded_list);
    return encodedList ?? null;
  }

  return null;
}

export async function resolveCredentialStatus(
  vc: Record<string, unknown>,
  statusEndpointOverride?: string,
): Promise<CredentialStatusResolution> {
  const pointer = extractStatusListPointer(vc);
  if (!pointer) {
    return { status: 'uncheckable', reason: 'Missing status list pointer' };
  }

  const listUrl = statusEndpointOverride
    ? buildStatusListUrl(statusEndpointOverride, pointer.listId)
    : pointer.listUrl;

  if (!listUrl) {
    return {
      status: 'uncheckable',
      reason: 'Status list URL missing',
      statusUrl: pointer.statusUrl,
      listId: pointer.listId,
      index: pointer.index,
    };
  }

  try {
    const response = await fetch(listUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/statuslist+json, application/json',
      },
    });

    if (!response.ok) {
      return {
        status: 'uncheckable',
        reason: `Status list fetch failed (${response.status})`,
        statusUrl: pointer.statusUrl ?? statusEndpointOverride,
        listId: pointer.listId,
        index: pointer.index,
        listUrl,
      };
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const encodedList = extractEncodedList(payload);

    if (!encodedList) {
      return {
        status: 'uncheckable',
        reason: 'Status list response missing encoded list',
        statusUrl: pointer.statusUrl ?? statusEndpointOverride,
        listId: pointer.listId,
        index: pointer.index,
        listUrl,
      };
    }

    const revoked = isIndexRevoked(encodedList, pointer.index);
    if (revoked === null) {
      return {
        status: 'uncheckable',
        reason: 'Status list index out of range',
        statusUrl: pointer.statusUrl ?? statusEndpointOverride,
        listId: pointer.listId,
        index: pointer.index,
        listUrl,
      };
    }

    return {
      status: revoked ? 'revoked' : 'active',
      statusUrl: pointer.statusUrl ?? statusEndpointOverride,
      listId: pointer.listId,
      index: pointer.index,
      listUrl,
    };
  } catch (error) {
    return {
      status: 'uncheckable',
      reason: error instanceof Error ? error.message : 'Status list resolution failed',
      statusUrl: pointer.statusUrl ?? statusEndpointOverride,
      listId: pointer.listId,
      index: pointer.index,
      listUrl,
    };
  }
}
