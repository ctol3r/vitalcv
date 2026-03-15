import { createQaFinding, type QaFinding } from './types';

type OpenApiLikeDocument = {
  paths?: Record<string, Record<string, unknown> | undefined>;
};

export interface ApiContractTestResult {
  documentedCount: number;
  runtimeCount: number;
  findings: QaFinding[];
}

function normalizePath(path: string): string {
  return path
    .replace(/\{([A-Za-z0-9_]+)\}/g, ':$1')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '') || '/';
}

export function extractDocumentedEndpoints(document: OpenApiLikeDocument): Array<{ method: string; path: string }> {
  const endpoints: Array<{ method: string; path: string }> = [];

  for (const [path, methods] of Object.entries(document.paths ?? {})) {
    for (const method of Object.keys(methods ?? {})) {
      endpoints.push({
        method: method.toUpperCase(),
        path: normalizePath(path),
      });
    }
  }

  return endpoints.sort((left, right) =>
    `${left.method} ${left.path}`.localeCompare(`${right.method} ${right.path}`),
  );
}

export function testApiContracts(
  runtimeEndpoints: readonly { method: string; path: string }[],
  documentedEndpoints: readonly { method: string; path: string }[],
  specName: string,
): ApiContractTestResult {
  const findings: QaFinding[] = [];
  const runtimeKeys = new Set(
    runtimeEndpoints.map((endpoint) => `${endpoint.method.toUpperCase()} ${normalizePath(endpoint.path)}`),
  );

  for (const endpoint of documentedEndpoints) {
    const key = `${endpoint.method.toUpperCase()} ${normalizePath(endpoint.path)}`;
    if (!runtimeKeys.has(key)) {
      findings.push(
        createQaFinding({
          code: 'documented_endpoint_missing_runtime',
          severity: 'critical',
          component: 'api-contract-tester',
          summary: `${specName} documents ${key}, but the runtime route inventory did not expose it.`,
          method: endpoint.method.toUpperCase(),
          endpoint: normalizePath(endpoint.path),
          metadata: {
            specName,
          },
        }),
      );
    }
  }

  return {
    documentedCount: documentedEndpoints.length,
    runtimeCount: runtimeEndpoints.length,
    findings,
  };
}
