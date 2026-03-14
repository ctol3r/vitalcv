import type { StoredCredential } from '../LocalCredentialStore';

export interface DescriptorFieldFilter {
  type?: string;
  pattern?: string;
  const?: unknown;
  enum?: unknown[];
}

export interface DescriptorField {
  path: string[];
  filter?: DescriptorFieldFilter;
}

export interface InputDescriptorLike {
  id: string;
  name?: string;
  purpose?: string;
  constraints?: {
    fields?: DescriptorField[];
  };
}

function normalizeJsonPath(path: string): string[] {
  return path
    .replace(/^\$\./, '')
    .replace(/\[['"]?([^'"\]]+)['"]?\]/g, '.$1')
    .split('.')
    .filter(Boolean);
}

function extractValues(source: unknown, path: string): unknown[] {
  const segments = normalizeJsonPath(path);
  let current: unknown[] = [source];

  for (const segment of segments) {
    const next: unknown[] = [];

    for (const item of current) {
      if (item == null) {
        continue;
      }

      if (Array.isArray(item)) {
        if (segment === '*') {
          next.push(...item);
          continue;
        }

        const index = Number(segment);
        if (Number.isInteger(index) && item[index] !== undefined) {
          next.push(item[index]);
        }
        continue;
      }

      if (typeof item === 'object') {
        const record = item as Record<string, unknown>;
        if (record[segment] !== undefined) {
          next.push(record[segment]);
        }
      }
    }

    current = next;
  }

  return current.flatMap((value) => (Array.isArray(value) ? value : [value]));
}

function coercePattern(filter: DescriptorFieldFilter): RegExp | null {
  if (!filter.pattern) {
    return null;
  }

  return new RegExp(filter.pattern, 'i');
}

function matchesFilter(value: unknown, filter?: DescriptorFieldFilter): boolean {
  if (!filter) {
    return value !== undefined;
  }

  if (filter.type === 'string' && typeof value !== 'string') {
    return false;
  }

  if (filter.type === 'number' && typeof value !== 'number') {
    return false;
  }

  if (filter.type === 'boolean' && typeof value !== 'boolean') {
    return false;
  }

  if (filter.const !== undefined && value !== filter.const) {
    return false;
  }

  if (filter.enum && !filter.enum.includes(value)) {
    return false;
  }

  const pattern = coercePattern(filter);
  if (pattern && !pattern.test(String(value))) {
    return false;
  }

  return true;
}

export function matchesInputDescriptor(
  credential: StoredCredential,
  descriptor: InputDescriptorLike,
): boolean {
  const fields = descriptor.constraints?.fields ?? [];

  if (fields.length === 0) {
    return true;
  }

  const candidate = {
    id: credential.id,
    npi: credential.npi,
    type: credential.type,
    issuer: credential.issuer,
    issuerDid: credential.issuerDid,
    status: credential.status,
    issuedAt: credential.issuedAt,
    expiresAt: credential.expiresAt,
    proofAlgorithm: credential.proofAlgorithm,
    claims: credential.claims,
  };

  return fields.every((field) =>
    field.path.some((path) => {
      const values = extractValues(candidate, path);
      return values.some((value) => matchesFilter(value, field.filter));
    }),
  );
}
