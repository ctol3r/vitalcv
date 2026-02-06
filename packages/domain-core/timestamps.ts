import { CanonicalPrimitiveError } from './errors';

const RFC3339_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export function assertNonEmptyString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CanonicalPrimitiveError(`${fieldName} is required`, 'MISSING_FIELD', {
      fieldName,
      value,
    });
  }
}

export function parseRfc3339Utc(value: unknown, fieldName: string): number {
  assertNonEmptyString(value, fieldName);

  if (!RFC3339_UTC.test(value)) {
    throw new CanonicalPrimitiveError(
      `${fieldName} must be a valid RFC3339 UTC timestamp`,
      'INVALID_TIMESTAMP',
      {
        fieldName,
        value,
      },
    );
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new CanonicalPrimitiveError(
      `${fieldName} must be a valid RFC3339 UTC timestamp`,
      'INVALID_TIMESTAMP',
      {
        fieldName,
        value,
      },
    );
  }

  return parsed;
}

export function assertStrictlyAfter(
  earlier: unknown,
  later: unknown,
  earlierField: string,
  laterField: string,
): void {
  const earlierTs = parseRfc3339Utc(earlier, earlierField);
  const laterTs = parseRfc3339Utc(later, laterField);

  if (laterTs <= earlierTs) {
    throw new CanonicalPrimitiveError(
      `${laterField} must be strictly after ${earlierField}`,
      'TIMESTAMP_ORDER',
      {
        earlierField,
        laterField,
        earlier,
        later,
      },
    );
  }
}
