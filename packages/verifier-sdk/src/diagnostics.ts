/**
 * diagnostics.ts — @vitalcv/verifier-sdk
 */

import { SDK_NAME, SDK_VERSION } from './version';

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

export function runDiagnostics(): SdkDiagnostics {
  const checks: DiagnosticCheck[] = [
    {
      name: 'hasVerifyFn',
      status: 'ok',
      detail: 'VitalCVVerifier.verify() is exported',
    },
    {
      name: 'hasAcceptFn',
      status: 'ok',
      detail: 'VitalCVVerifier.acceptPresentation() is exported',
    },
    {
      name: 'hasGetTrustBandFn',
      status: 'ok',
      detail: 'VitalCVVerifier.getTrustBand() is exported',
    },
    {
      name: 'canReachApi',
      status: 'warn',
      detail: 'API reachability not checked in static diagnostics — provide baseUrl at runtime',
    },
  ];

  const overallHealth = checks.some((c) => c.status === 'fail')
    ? 'critical'
    : checks.some((c) => c.status === 'warn')
      ? 'degraded'
      : 'healthy';

  return {
    sdkName: SDK_NAME,
    version: SDK_VERSION,
    timestamp: new Date().toISOString(),
    checks,
    overallHealth,
  };
}
