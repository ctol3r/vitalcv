import { createQaFinding, type QaFinding } from './types';

export type EdgeScanMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface EndpointDefinition {
  method: EdgeScanMethod;
  path: string;
  probeMethod?: EdgeScanMethod;
  body?: unknown;
  headers?: Record<string, string>;
  expectsJson?: boolean;
}

export interface EndpointProbeResult {
  statusCode: number;
  contentType: string | null;
  latencyMs: number;
  body: unknown;
}

export type EndpointProbeClient = (endpoint: EndpointDefinition) => Promise<EndpointProbeResult>;

export interface EdgeCaseScanResult {
  scannedCount: number;
  findings: QaFinding[];
}

const PARAM_SAMPLES: Record<string, string> = {
  npi: '1003000126',
  clinician_id: '1003000126',
  clinicianId: '1003000126',
  subject: '1003000126',
  subjectId: '1003000126',
  shareId: 'qa-share-id',
  bundleId: '00000000-0000-0000-0000-000000000001',
  artifactId: '00000000-0000-0000-0000-000000000001',
  credentialId: '00000000-0000-0000-0000-000000000001',
  organizationId: '00000000-0000-0000-0000-000000000001',
  opportunityId: '00000000-0000-0000-0000-000000000001',
  requestId: '00000000-0000-0000-0000-000000000001',
  capsuleId: '00000000-0000-0000-0000-000000000001',
  employerId: 'qa-employer',
  facilityId: 'qa-facility',
  networkId: 'qa-network',
  id: '00000000-0000-0000-0000-000000000001',
  nodeId: 'qa-node-id',
  did: 'did:vitalcv:qa-subject',
  method: 'web',
  subtype: 'resolver',
  slug: 'qa-slug',
  policyId: 'qa-policy-id',
};

function substituteParams(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)(\([^)]*\))?/g, (_match, rawName: string) => {
    const sample = PARAM_SAMPLES[rawName] ?? `qa-${rawName.toLowerCase()}`;
    return encodeURIComponent(sample);
  });
}

function shouldUseHeadProbe(path: string): boolean {
  return /(stream|download|export)(?:\/|$)/.test(path);
}

function shouldExpectJson(path: string): boolean {
  return !shouldUseHeadProbe(path);
}

function isJsonLike(contentType: string | null): boolean {
  return typeof contentType === 'string' && contentType.toLowerCase().includes('application/json');
}

function isMalformedPayload(body: unknown): boolean {
  if (body === null || body === undefined) {
    return true;
  }

  if (Array.isArray(body)) {
    return body.some((item) => item === null);
  }

  if (typeof body === 'object') {
    return Object.values(body as Record<string, unknown>).some(
      (value) => value === undefined || (typeof value === 'number' && Number.isNaN(value)),
    );
  }

  return false;
}

export function buildEdgeCaseEndpoints(paths: ReadonlyArray<{ method: string; path: string }>): EndpointDefinition[] {
  return paths
    .filter((entry) => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(entry.method))
    .map((entry) => {
      const path = substituteParams(entry.path);
      const probeMethod =
        entry.method === 'GET' && shouldUseHeadProbe(path)
          ? 'HEAD'
          : (entry.method as EdgeScanMethod);

      return {
        method: entry.method as EdgeScanMethod,
        path,
        probeMethod,
        body: entry.method === 'GET' || probeMethod === 'HEAD' ? undefined : {},
        expectsJson: shouldExpectJson(path),
      };
    });
}

export async function scanEndpointEdgeCases(
  endpoints: readonly EndpointDefinition[],
  probe: EndpointProbeClient,
): Promise<EdgeCaseScanResult> {
  const findings: QaFinding[] = [];

  for (const endpoint of endpoints) {
    try {
      const result = await probe(endpoint);
      const method = endpoint.probeMethod ?? endpoint.method;

      if (result.statusCode >= 500) {
        findings.push(
          createQaFinding({
            code: 'endpoint_server_error',
            severity: 'critical',
            component: 'edge-case-scanner',
            summary: `Edge-case probe returned ${result.statusCode} for ${method} ${endpoint.path}.`,
            method,
            endpoint: endpoint.path,
            metadata: {
              statusCode: result.statusCode,
              latencyMs: result.latencyMs,
            },
          }),
        );
        continue;
      }

      if (endpoint.expectsJson && result.statusCode !== 204 && method !== 'HEAD') {
        if (!isJsonLike(result.contentType)) {
          findings.push(
            createQaFinding({
              code: 'endpoint_non_json_response',
              severity: 'warning',
              component: 'edge-case-scanner',
              summary: `Expected JSON from ${method} ${endpoint.path}, received ${result.contentType ?? 'no content-type'}.`,
              method,
              endpoint: endpoint.path,
              metadata: {
                statusCode: result.statusCode,
                contentType: result.contentType,
              },
            }),
          );
        } else if (isMalformedPayload(result.body)) {
          findings.push(
            createQaFinding({
              code: 'endpoint_malformed_payload',
              severity: 'critical',
              component: 'edge-case-scanner',
              summary: `Probe detected a null or malformed payload from ${method} ${endpoint.path}.`,
              method,
              endpoint: endpoint.path,
              metadata: {
                statusCode: result.statusCode,
              },
            }),
          );
        }
      }
    } catch (error) {
      findings.push(
        createQaFinding({
          code: 'endpoint_probe_failed',
          severity: 'critical',
          component: 'edge-case-scanner',
          summary: `Edge-case probe failed for ${(endpoint.probeMethod ?? endpoint.method)} ${endpoint.path}.`,
          method: endpoint.probeMethod ?? endpoint.method,
          endpoint: endpoint.path,
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
        }),
      );
    }
  }

  return {
    scannedCount: endpoints.length,
    findings,
  };
}

