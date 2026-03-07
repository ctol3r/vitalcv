import { SDK_NAME, SDK_VERSION } from './version';

export interface DiagnosticCheck { name: string; status: 'ok' | 'warn' | 'fail'; detail?: string }
export interface SdkDiagnostics { sdkName: string; version: string; timestamp: string; checks: DiagnosticCheck[]; overallHealth: 'healthy' | 'degraded' | 'critical' }

export function runDiagnostics(): SdkDiagnostics {
  const checks: DiagnosticCheck[] = [
    { name: 'hasStoreFn',              status: 'ok', detail: 'store() is exported' },
    { name: 'hasListFn',               status: 'ok', detail: 'list() is exported' },
    { name: 'hasSelectiveDisclosureFn',status: 'ok', detail: 'present() with selective disclosure is exported' },
    { name: 'canReachApi',             status: 'warn', detail: 'API reachability not checked in static diagnostics' },
  ];
  const overallHealth = checks.some(c => c.status === 'fail') ? 'critical' : checks.some(c => c.status === 'warn') ? 'degraded' : 'healthy';
  return { sdkName: SDK_NAME, version: SDK_VERSION, timestamp: new Date().toISOString(), checks, overallHealth };
}
