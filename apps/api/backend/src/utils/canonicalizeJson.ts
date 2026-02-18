export function canonicalizeJson(payload: object): string {
  return canonicalizeValue(payload);
}

function canonicalizeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalizeValue(entry)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    const keys = Object.keys(objectValue).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalizeValue(objectValue[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}
