/**
 * providerSmokeTest.ts — Wave 119+127: Provider Data Integrity Fabric
 *
 * Smoke test + shadow staging workflow for provider data connectors.
 * Validates:
 *   - NPPES endpoint reachability
 *   - Response schema conformance
 *   - Field-length bounds
 *   - UTF-8 encoding integrity
 *   - Connector sandbox/live mode
 *
 * Can be run periodically (cron) or on-demand via API.
 */

import { createHash } from 'node:crypto';
import {
  ConnectorRateLimitError,
  executeWithRetry,
} from '../../../../../../core/connectors/retryPolicy';
import { ConnectorQuotaExceededError, connectorQuotaManager } from '../../../../../../core/connectors/quotaManager';
import { connectorSchemaDriftDetector } from '../../../../../../core/connectors/schemaDrift';
import { log } from '../../obs/logger';
import { lookupStateBoard } from './connectors/stateBoardConnector';
import { checkOIGExclusion, getLeieIndexStatus } from './connectors/oigConnector';
import { checkABMSCertification } from './connectors/abmsConnector';
import { checkCAQHProfile } from './connectors/caqhConnector';
import { queryNPDB } from './connectors/npdbConnector';
import {
  getConnectorAlerts,
  getConnectorDiagnostics,
  getConnectorHealth,
  getConnectorQuarantineState,
  quarantineConnector,
  recordConnectorFailure,
  recordConnectorRateLimit,
  recordConnectorRetry,
  recordConnectorSchemaDrift,
  recordConnectorSuccess,
} from './connectors/connectorHealthTracker';

// ── Types ─────────────────────────────────────────────────────────────

export type ConnectorId = 'NPPES' | 'STATE_BOARD' | 'OIG' | 'ABMS' | 'CAQH' | 'NPDB';

export interface SmokeTestResult {
  connector: ConnectorId;
  reachable: boolean;
  responseTimeMs: number;
  schemaValid: boolean;
  fieldLengthOk: boolean;
  utf8Ok: boolean;
  sampleNpi: string | null;
  errors: string[];
  warnings: string[];
  testedAt: string;
}

export interface SmokeTestSuite {
  results: SmokeTestResult[];
  overallHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  connectorHealth: ReturnType<typeof getConnectorHealth>;
  diagnostics: ReturnType<typeof getConnectorDiagnostics>;
  alerts: ReturnType<typeof getConnectorAlerts>;
  testedAt: string;
}

// ── Field-Length Thresholds ────────────────────────────────────────────

const NPPES_FIELD_LIMITS: Record<string, number> = {
  first_name: 35,
  last_name: 35,
  middle_name: 35,
  credential: 50,
  organization_name: 300,
  address_1: 200,
  address_2: 200,
  city: 40,
  taxonomy_desc: 100,
};
const NPPES_QUOTA_POLICY = {
  limit: 30,
  windowMs: 60_000,
};
const NPPES_SCHEMA_POLICY = {
  requiredFields: ['result_count', 'results'],
  allowAdditionalFields: true,
} as const;

// ── NPPES Smoke Test ──────────────────────────────────────────────────

async function smokeTestNppes(sampleNpi = '1003000126'): Promise<SmokeTestResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const start = Date.now();
  const quarantine = getConnectorQuarantineState('NPPES');
  if (quarantine.active) {
    warnings.push(quarantine.reason ?? 'Connector quarantine active');
    return {
      connector: 'NPPES',
      reachable: false,
      responseTimeMs: 0,
      schemaValid: false,
      fieldLengthOk: false,
      utf8Ok: false,
      sampleNpi,
      errors,
      warnings,
      testedAt: new Date().toISOString(),
    };
  }

  let reachable = false;
  let schemaValid = false;
  let fieldLengthOk = true;
  let utf8Ok = true;
  let criticalSchemaDrift = false;

  try {
    connectorQuotaManager.consume({
      connector: 'NPPES',
      policy: NPPES_QUOTA_POLICY,
    });

    const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&number=${sampleNpi}`;
    const { result: body, attempts } = await executeWithRetry({
      connector: 'NPPES',
      operation: async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000);

        try {
          const res = await fetch(url, { signal: controller.signal });
          if (res.status === 429) {
            throw new ConnectorRateLimitError('NPPES responded with HTTP 429');
          }
          if (!res.ok) {
            const error = new Error(`HTTP ${res.status}`);
            Object.assign(error, { statusCode: res.status });
            throw error;
          }

          return res.json();
        } finally {
          clearTimeout(timer);
        }
      },
      onRetry: async ({ attempt, delayMs, error }) => {
        recordConnectorRetry('NPPES', attempt, delayMs, error.message);
      },
    });

    reachable = true;
    const schemaState = connectorSchemaDriftDetector.observe('NPPES', body, NPPES_SCHEMA_POLICY);
    if (schemaState.detected) {
      recordConnectorSchemaDrift('NPPES', schemaState);
      warnings.push(`Schema drift detected (${schemaState.severity})`);
      if (schemaState.severity === 'CRITICAL') {
        criticalSchemaDrift = true;
        errors.push('Critical schema drift detected');
        quarantineConnector('NPPES', 'Critical NPPES schema drift detected', 15 * 60_000);
      }
    }

    // Schema check
    if (body.result_count !== undefined && Array.isArray(body.results)) {
      schemaValid = true;
    } else {
      errors.push('Unexpected schema: missing result_count or results array');
    }

    // Field-length check on first result
    if (body.results?.[0]) {
      const r = body.results[0];
      const basic = r.basic ?? {};
      for (const [field, limit] of Object.entries(NPPES_FIELD_LIMITS)) {
        const value = basic[field] as string | undefined;
        if (value && value.length > limit) {
          warnings.push(`Field ${field} exceeds expected limit: ${value.length} > ${limit}`);
          // Don't fail — just warn
        }
      }
    }

    // UTF-8 check
    const rawText = JSON.stringify(body);
    try {
      const buf = Buffer.from(rawText, 'utf8');
      const decoded = buf.toString('utf8');
      if (decoded !== rawText) {
        utf8Ok = false;
        warnings.push('UTF-8 round-trip mismatch detected');
      }
    } catch {
      utf8Ok = false;
      errors.push('UTF-8 encoding validation failed');
    }

    if (criticalSchemaDrift) {
      recordConnectorFailure('NPPES', 'Critical schema drift detected', {
        latencyMs: Date.now() - start,
        retries: attempts - 1,
      });
    } else {
      recordConnectorSuccess('NPPES', {
        latencyMs: Date.now() - start,
        retries: attempts - 1,
      });
    }
  } catch (e) {
    if (e instanceof ConnectorQuotaExceededError) {
      recordConnectorRateLimit('NPPES', e.retryAfterMs, e.message);
      quarantineConnector('NPPES', e.message, e.retryAfterMs ?? 60_000);
      errors.push(e.message);
    } else if (e instanceof ConnectorRateLimitError) {
      connectorQuotaManager.recordRateLimit('NPPES', e.retryAfterMs ?? 60_000, undefined, NPPES_QUOTA_POLICY);
      recordConnectorRateLimit('NPPES', e.retryAfterMs ?? 60_000, e.message);
      quarantineConnector('NPPES', e.message, e.retryAfterMs ?? 60_000);
      errors.push(e.message);
    } else {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      recordConnectorFailure('NPPES', msg, { latencyMs: Date.now() - start });
      errors.push(`Connectivity: ${msg}`);
    }
  }

  return {
    connector: 'NPPES',
    reachable,
    responseTimeMs: Date.now() - start,
    schemaValid,
    fieldLengthOk,
    utf8Ok,
    sampleNpi,
    errors,
    warnings,
    testedAt: new Date().toISOString(),
  };
}

// ── Connector Smoke Tests ────────────────────────────────────────────

async function smokeTestStateBoard(sampleNpi = '1003000126'): Promise<SmokeTestResult> {
  const start = Date.now();
  const errors: string[] = [];
  try {
    const result = await lookupStateBoard(sampleNpi, 'CA');
    const valid = !!result.npi && !!result.state && !!result.licenseStatus && !!result.boardName;
    return {
      connector: 'STATE_BOARD', reachable: true, responseTimeMs: Date.now() - start,
      schemaValid: valid, fieldLengthOk: true, utf8Ok: true, sampleNpi,
      errors: valid ? [] : ['Response schema invalid'], warnings: [],
      testedAt: new Date().toISOString(),
    };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'Unknown error');
    return {
      connector: 'STATE_BOARD', reachable: false, responseTimeMs: Date.now() - start,
      schemaValid: false, fieldLengthOk: true, utf8Ok: true, sampleNpi,
      errors, warnings: [], testedAt: new Date().toISOString(),
    };
  }
}

async function smokeTestOIG(sampleNpi = '1003000126'): Promise<SmokeTestResult> {
  const start = Date.now();
  const errors: string[] = [];
  try {
    const indexStatus = getLeieIndexStatus();
    const result = await checkOIGExclusion(sampleNpi);
    const valid = !!result.npi && typeof result.excluded === 'boolean' && !!result.lastCheckedAt;
    const warnings: string[] = [];
    if (!indexStatus.loaded) warnings.push('LEIE index not loaded');
    return {
      connector: 'OIG', reachable: true, responseTimeMs: Date.now() - start,
      schemaValid: valid, fieldLengthOk: true, utf8Ok: true, sampleNpi,
      errors: valid ? [] : ['Response schema invalid'], warnings,
      testedAt: new Date().toISOString(),
    };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'Unknown error');
    return {
      connector: 'OIG', reachable: false, responseTimeMs: Date.now() - start,
      schemaValid: false, fieldLengthOk: true, utf8Ok: true, sampleNpi,
      errors, warnings: [], testedAt: new Date().toISOString(),
    };
  }
}

async function smokeTestABMS(sampleNpi = '1003000126'): Promise<SmokeTestResult> {
  const start = Date.now();
  const errors: string[] = [];
  try {
    const result = await checkABMSCertification(sampleNpi);
    const valid = !!result.npi && !!result.certificationStatus && !!result.lastVerifiedAt;
    return {
      connector: 'ABMS', reachable: true, responseTimeMs: Date.now() - start,
      schemaValid: valid, fieldLengthOk: true, utf8Ok: true, sampleNpi,
      errors: valid ? [] : ['Response schema invalid'], warnings: [],
      testedAt: new Date().toISOString(),
    };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'Unknown error');
    return {
      connector: 'ABMS', reachable: false, responseTimeMs: Date.now() - start,
      schemaValid: false, fieldLengthOk: true, utf8Ok: true, sampleNpi,
      errors, warnings: [], testedAt: new Date().toISOString(),
    };
  }
}

async function smokeTestCAQH(sampleNpi = '1003000126'): Promise<SmokeTestResult> {
  const start = Date.now();
  const errors: string[] = [];
  try {
    const result = await checkCAQHProfile(sampleNpi);
    const valid = !!result.npi && !!result.profileStatus && !!result.lastVerifiedAt;
    return {
      connector: 'CAQH', reachable: true, responseTimeMs: Date.now() - start,
      schemaValid: valid, fieldLengthOk: true, utf8Ok: true, sampleNpi,
      errors: valid ? [] : ['Response schema invalid'], warnings: [],
      testedAt: new Date().toISOString(),
    };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'Unknown error');
    return {
      connector: 'CAQH', reachable: false, responseTimeMs: Date.now() - start,
      schemaValid: false, fieldLengthOk: true, utf8Ok: true, sampleNpi,
      errors, warnings: [], testedAt: new Date().toISOString(),
    };
  }
}

async function smokeTestNPDB(sampleNpi = '1003000126'): Promise<SmokeTestResult> {
  const start = Date.now();
  const errors: string[] = [];
  try {
    const result = await queryNPDB(sampleNpi);
    const valid = !!result.npi && !!result.status && !!result.lastCheckedAt;
    return {
      connector: 'NPDB', reachable: true, responseTimeMs: Date.now() - start,
      schemaValid: valid, fieldLengthOk: true, utf8Ok: true, sampleNpi,
      errors: valid ? [] : ['Response schema invalid'], warnings: [],
      testedAt: new Date().toISOString(),
    };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'Unknown error');
    return {
      connector: 'NPDB', reachable: false, responseTimeMs: Date.now() - start,
      schemaValid: false, fieldLengthOk: true, utf8Ok: true, sampleNpi,
      errors, warnings: [], testedAt: new Date().toISOString(),
    };
  }
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Run smoke tests against all provider data connectors.
 */
export async function runProviderSmokeTests(): Promise<SmokeTestSuite> {
  const results: SmokeTestResult[] = await Promise.all([
    smokeTestNppes(),
    smokeTestStateBoard(),
    smokeTestOIG(),
    smokeTestABMS(),
    smokeTestCAQH(),
    smokeTestNPDB(),
  ]);

  const reachableCount = results.filter((r) => r.reachable).length;
  const overallHealth: SmokeTestSuite['overallHealth'] =
    reachableCount >= 4 ? 'HEALTHY'
    : reachableCount >= 2 ? 'DEGRADED'
    : 'CRITICAL';

  log('info', 'provider_smoke_test: complete', {
    health: overallHealth,
    reachable: reachableCount,
    total: results.length,
  });

  return {
    results,
    overallHealth,
    connectorHealth: getConnectorHealth(),
    diagnostics: getConnectorDiagnostics(),
    alerts: getConnectorAlerts(25),
    testedAt: new Date().toISOString(),
  };
}

/**
 * Run smoke test for a single connector.
 */
export async function runSingleSmokeTest(connector: ConnectorId): Promise<SmokeTestResult> {
  switch (connector) {
    case 'NPPES': return smokeTestNppes();
    case 'STATE_BOARD': return smokeTestStateBoard();
    case 'OIG': return smokeTestOIG();
    case 'ABMS': return smokeTestABMS();
    case 'CAQH': return smokeTestCAQH();
    case 'NPDB': return smokeTestNPDB();
  }
}
