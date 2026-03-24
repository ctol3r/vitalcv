import { createHash } from 'node:crypto';

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeAddressPart(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return normalizeWhitespace(value)
    .normalize('NFKC')
    .toUpperCase();
}

export function normalizeInstitutionKey(value: string): string {
  return normalizeAddressPart(value)
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function hashAddress(parts: Array<string | null | undefined>): string {
  const normalized = parts.map((part) => normalizeAddressPart(part)).join('|');
  return createHash('sha256').update(normalized).digest('hex');
}
