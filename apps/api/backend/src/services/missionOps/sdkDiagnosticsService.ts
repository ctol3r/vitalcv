/**
 * sdkDiagnosticsService.ts — Wave 133: SDK Productization
 *
 * Aggregates diagnostics from all three VitalCV SDKs.
 * Stubs are used if SDK packages are not resolvable at runtime.
 */

import { log } from '../../obs/logger';

export interface DiagnosticCheck {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  detail?: string;
}

export interface SdkDiagnostics {
  sdkName: string;
  version: string;
  timestamp: string;
  checks: DiagnosticCheck[];
  overallHealth: 'healthy' | 'degraded' | 'critical';
}

export interface SDKDiagnosticsReport {
  verifier: SdkDiagnostics;
  issuer: SdkDiagnostics;
  wallet: SdkDiagnostics;
  overallHealth: 'healthy' | 'degraded' | 'critical';
  generatedAt: string;
}

function stubDiagnostics(sdkName: string): SdkDiagnostics {
  return {
    sdkName,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    checks: [
      { name: 'sdkResolvable', status: 'warn', detail: `${sdkName} not resolvable in this runtime — using stub` },
    ],
    overallHealth: 'degraded',
  };
}

async function loadSdkDiagnostics(
  pkgName: string,
  sdkLabel: string,
): Promise<SdkDiagnostics> {
  try {
    // Dynamic import — works if SDK is installed in the monorepo
    const mod = await import(pkgName) as { runDiagnostics?: () => SdkDiagnostics };
    if (typeof mod.runDiagnostics === 'function') {
      return mod.runDiagnostics();
    }
    return stubDiagnostics(sdkLabel);
  } catch {
    return stubDiagnostics(sdkLabel);
  }
}

export async function getSDKDiagnosticsReport(): Promise<SDKDiagnosticsReport> {
  const [verifier, issuer, wallet] = await Promise.all([
    loadSdkDiagnostics('@vitalcv/verifier-sdk', '@vitalcv/verifier-sdk'),
    loadSdkDiagnostics('@vitalcv/issuer-sdk', '@vitalcv/issuer-sdk'),
    loadSdkDiagnostics('@vitalcv/wallet-sdk', '@vitalcv/wallet-sdk'),
  ]);

  const allChecks = [...verifier.checks, ...issuer.checks, ...wallet.checks];
  const overallHealth: SDKDiagnosticsReport['overallHealth'] =
    allChecks.some((c) => c.status === 'fail')
      ? 'critical'
      : allChecks.some((c) => c.status === 'warn')
        ? 'degraded'
        : 'healthy';

  log('info', 'sdk_diagnostics_report', { overallHealth });

  return {
    verifier,
    issuer,
    wallet,
    overallHealth,
    generatedAt: new Date().toISOString(),
  };
}
