import { createHash, randomBytes } from 'crypto';

export function canonicalize(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const fragments = keys.map(
      (key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`,
    );
    return `{${fragments.join(',')}}`;
  }

  return JSON.stringify(value);
}

export function generateSalt(bytes = 16): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashDisclosureValue(path: string, value: any, salt: string): string {
  const canonical = canonicalize(value);
  return createHash('sha256')
    .update(`${path}|${salt}|${canonical}`)
    .digest('base64url');
}

export function cloneDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function getValueAtPath(source: any, path: string): any {
  const segments = path.split('.');
  return segments.reduce((acc, segment) => {
    if (acc === undefined || acc === null) {
      return undefined;
    }
    return acc[segment];
  }, source);
}

export function setValueAtPath(target: any, path: string, value: any): void {
  const segments = path.split('.');
  const last = segments.pop();

  if (!last) {
    return;
  }

  let cursor = target;
  for (const segment of segments) {
    if (typeof cursor[segment] !== 'object' || cursor[segment] === null) {
      cursor[segment] = {};
    }
    cursor = cursor[segment];
  }

  cursor[last] = value;
}

export function unsetPath(target: any, path: string): void {
  const segments = path.split('.');
  const last = segments.pop();
  if (!last) {
    return;
  }

  let cursor = target;
  const parentStack: any[] = [];

  for (const segment of segments) {
    if (cursor[segment] === undefined) {
      return;
    }
    parentStack.push({ parent: cursor, key: segment });
    cursor = cursor[segment];
  }

  if (cursor && Object.prototype.hasOwnProperty.call(cursor, last)) {
    delete cursor[last];
  }

  // Clean up empty parent containers to keep payload compact
  for (let i = parentStack.length - 1; i >= 0; i--) {
    const { parent, key } = parentStack[i];
    if (
      parent[key] &&
      typeof parent[key] === 'object' &&
      Object.keys(parent[key]).length === 0
    ) {
      delete parent[key];
    }
  }
}

export function base64UrlEncode(input: any): string {
  const json = typeof input === 'string' ? input : JSON.stringify(input);
  return Buffer.from(json).toString('base64url');
}

export function base64UrlDecode<T = any>(encoded: string): T {
  const decoded = Buffer.from(encoded, 'base64url').toString('utf8');
  return JSON.parse(decoded) as T;
}


