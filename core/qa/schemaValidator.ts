import { createQaFinding, type QaFinding } from './types';

type OpenApiLikeDocument = {
  paths?: Record<string, Record<string, unknown> | undefined>;
};

interface SchemaSignature {
  requestBodyRequired: boolean;
  requestHash: string;
  responseHash: string;
}

export interface SchemaConsistencyResult {
  findings: QaFinding[];
}

function normalizePath(path: string): string {
  return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`);

  return `{${entries.join(',')}}`;
}

function extractSignature(operation: Record<string, unknown>): SchemaSignature {
  const requestBody = operation.requestBody as Record<string, unknown> | undefined;
  const responses = operation.responses as Record<string, unknown> | undefined;

  return {
    requestBodyRequired: requestBody?.required === true,
    requestHash: stableSerialize(requestBody?.content ?? {}),
    responseHash: stableSerialize(responses ?? {}),
  };
}

function extractSignatures(document: OpenApiLikeDocument): Map<string, SchemaSignature> {
  const signatures = new Map<string, SchemaSignature>();

  for (const [path, methods] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(methods ?? {})) {
      if (!operation || typeof operation !== 'object') {
        continue;
      }

      signatures.set(
        `${method.toUpperCase()} ${normalizePath(path)}`,
        extractSignature(operation as Record<string, unknown>),
      );
    }
  }

  return signatures;
}

export function validateSchemaConsistency(
  leftName: string,
  leftDocument: OpenApiLikeDocument,
  rightName: string,
  rightDocument: OpenApiLikeDocument,
): SchemaConsistencyResult {
  const findings: QaFinding[] = [];
  const leftSignatures = extractSignatures(leftDocument);
  const rightSignatures = extractSignatures(rightDocument);

  const keys = new Set([...leftSignatures.keys(), ...rightSignatures.keys()]);

  for (const key of keys) {
    const left = leftSignatures.get(key);
    const right = rightSignatures.get(key);

    if (!left || !right) {
      findings.push(
        createQaFinding({
          code: 'schema_endpoint_drift',
          severity: 'warning',
          component: 'schema-validator',
          summary: `${key} is defined in ${left ? leftName : rightName} but missing from ${left ? rightName : leftName}.`,
          method: key.split(' ')[0],
          endpoint: key.slice(key.indexOf(' ') + 1),
          metadata: {
            leftName,
            rightName,
          },
        }),
      );
      continue;
    }

    if (
      left.requestBodyRequired !== right.requestBodyRequired
      || left.requestHash !== right.requestHash
      || left.responseHash !== right.responseHash
    ) {
      findings.push(
        createQaFinding({
          code: 'schema_signature_mismatch',
          severity: 'warning',
          component: 'schema-validator',
          summary: `${key} has diverged request/response schema signatures between ${leftName} and ${rightName}.`,
          method: key.split(' ')[0],
          endpoint: key.slice(key.indexOf(' ') + 1),
          metadata: {
            leftName,
            rightName,
            requestBodyRequired: {
              [leftName]: left.requestBodyRequired,
              [rightName]: right.requestBodyRequired,
            },
          },
        }),
      );
    }
  }

  return { findings };
}
