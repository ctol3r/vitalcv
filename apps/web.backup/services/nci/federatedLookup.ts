import axios, { type AxiosRequestConfig } from 'axios';
import { randomUUID } from 'crypto';
import { Agent as HttpsAgent } from 'https';
import { importJWK, SignJWT, calculateJwkThumbprint, type JWK } from 'jose';
import type {
  FederatedLookupOptions,
  FederatedLookupResult,
  FederatedNodeConfig,
  FederatedNodePayload,
  FederatedNodeResult,
  LicenseRecordSummary,
  EnrollmentRecordSummary,
  PrivilegeVerificationRecord,
  TrustAnchorEntry,
  FederatedNodeAuth,
} from './types';

const DEFAULT_NODE_TIMEOUT_MS = 4_500;

function emptyAggregate() {
  return {
    licenseRecords: [] as LicenseRecordSummary[],
    privilegeRecords: [] as PrivilegeVerificationRecord[],
    enrollmentRecords: [] as EnrollmentRecordSummary[],
    trustAnchors: [] as TrustAnchorEntry[],
  };
}

export async function runFederatedLookup(options: FederatedLookupOptions): Promise<FederatedLookupResult> {
  const nodes = (options.nodes ?? []).filter((node) => node.enabled !== false);
  if (nodes.length === 0) {
    return {
      nodes: [],
      aggregated: emptyAggregate(),
    };
  }

  const settled = await Promise.allSettled(
    nodes.map((node) => queryNode(node, options.npi, options.requestId, options.timeoutMs))
  );

  const aggregate = emptyAggregate();
  const results: FederatedNodeResult[] = [];

  for (const entry of settled) {
    if (entry.status === 'fulfilled') {
      results.push(entry.value);
      if (entry.value.status === 'ok' && entry.value.payload) {
        if (entry.value.payload.licenseRecords?.length) {
          aggregate.licenseRecords.push(
            ...entry.value.payload.licenseRecords.map((record) => ({
              ...record,
              source: record.source ?? `federated:${entry.value.id}`,
            }))
          );
        }
        if (entry.value.payload.privilegeRecords?.length) {
          aggregate.privilegeRecords.push(...entry.value.payload.privilegeRecords);
        }
        if (entry.value.payload.enrollmentRecords?.length) {
          aggregate.enrollmentRecords.push(...entry.value.payload.enrollmentRecords);
        }
        if (entry.value.payload.trustAnchors?.length) {
          aggregate.trustAnchors.push(...entry.value.payload.trustAnchors);
        }
      } else if (entry.value.status === 'ok') {
        aggregate.trustAnchors.push({
          type: 'FEDERATED_NODE',
          source: entry.value.id,
          referenceId: entry.value.id,
          lastVerifiedAt: new Date().toISOString(),
          metadata: { message: 'No structured payload returned' },
        });
      }
      continue;
    }

    results.push({
      id: entry.reason?.id ?? 'unknown',
      status: 'error',
      latencyMs: entry.reason?.latencyMs ?? 0,
      error: entry.reason instanceof Error ? entry.reason.message : 'Unknown federated error',
    });
  }

  return {
    nodes: results,
    aggregated: aggregate,
  };
}

async function queryNode(
  node: FederatedNodeConfig,
  npi: string,
  requestId?: string,
  timeoutOverride?: number
): Promise<FederatedNodeResult> {
  const method = (node.method ?? 'POST').toUpperCase();
  const url = node.endpoint;
  const controller = new AbortController();
  const timeoutMs = node.timeoutMs ?? timeoutOverride ?? DEFAULT_NODE_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs + 250);
  const startedAt = Date.now();

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Request-ID': requestId ?? randomUUID(),
    };

    const config: AxiosRequestConfig = {
      url,
      method,
      timeout: timeoutMs,
      data: method === 'GET' ? undefined : { npi },
      params: method === 'GET' ? { npi } : undefined,
      headers,
      signal: controller.signal,
      httpsAgent: buildAgent(node.auth),
    };

    if (node.auth?.type === 'dpop') {
      const proof = await buildDpopProof({
        htm: method,
        htu: url,
        jwk: node.auth.jwk,
      });
      headers.DPoP = proof.proof;
      headers['DPoP-JKT'] = proof.jkt;
      if (node.auth.accessToken) {
        headers.Authorization = `DPoP ${node.auth.accessToken}`;
      }
    }

    const response = await axios.request<FederatedNodePayload>(config);
    const latencyMs = Date.now() - startedAt;

    return {
      id: node.id,
      status: 'ok',
      latencyMs,
      httpStatus: response.status,
      payload: response.data,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    return {
      id: node.id,
      status: 'error',
      latencyMs,
      error: error instanceof Error ? error.message : 'Unknown federated node error',
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildAgent(auth?: FederatedNodeAuth) {
  if (!auth || auth.type !== 'mtls') {
    return undefined;
  }

  return new HttpsAgent({
    cert: auth.cert,
    key: auth.key,
    ca: auth.ca,
    passphrase: auth.passphrase,
    rejectUnauthorized: auth.rejectUnauthorized !== false,
  });
}

async function buildDpopProof(options: { htu: string; htm: string; jwk: JWK }) {
  const alg = options.jwk.alg ?? (options.jwk.kty === 'OKP' ? 'EdDSA' : 'ES256');
  const signer = await importJWK(options.jwk, alg);
  const jkt = await calculateJwkThumbprint(options.jwk);
  const proof = await new SignJWT({
    htm: options.htm,
    htu: options.htu,
    jti: randomUUID(),
  })
    .setProtectedHeader({
      typ: 'dpop+jwt',
      alg,
      jwk: {
        ...options.jwk,
        d: undefined,
      },
    })
    .setIssuedAt()
    .setExpirationTime('2m')
    .sign(signer);

  return { proof, jkt };
}

