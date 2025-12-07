/**
 * B165B-TLS-007: Certificate Expiry Monitor
 *
 * - Checks external HTTPS endpoints for certificate expiration
 * - Alerts when certificates have < 14 days remaining (default)
 * - Designed to run daily via cron or GitHub Actions
 *
 * Usage:
 *   node jobs/security/certExpiryMonitor.ts
 *
 * Environment:
 *   CERT_MONITOR_TARGETS="demo.vitalcv.com:443|stage.vitalcv.com:443"
 *   CERT_MONITOR_THRESHOLD_DAYS=14
 */

import tls from 'tls';

export interface CertTarget {
  host: string;
  port?: number;
  name?: string;
  daysBeforeAlert?: number;
}

export interface CertCheckResult {
  host: string;
  port: number;
  name?: string;
  expiresAt?: string;
  daysRemaining?: number;
  valid: boolean;
  message: string;
  alert: boolean;
}

export interface CertMonitorSummary {
  checked: number;
  alerts: number;
  failures: number;
  results: CertCheckResult[];
}

export interface CertMonitorOptions {
  targets?: CertTarget[];
  fetcher?: (target: CertTarget) => Promise<CertCheckResult>;
  defaultThresholdDays?: number;
}

const DEFAULT_THRESHOLD = parseInt(process.env.CERT_MONITOR_THRESHOLD_DAYS || '14', 10);

/**
 * Entry point used by schedulers/tests
 */
export async function runCertExpiryMonitor(options: CertMonitorOptions = {}): Promise<CertMonitorSummary> {
  const targets = options.targets ?? loadTargetsFromEnv();
  const fetcher = options.fetcher ?? fetchCertificateMetadata;
  const threshold = options.defaultThresholdDays ?? DEFAULT_THRESHOLD;

  if (targets.length === 0) {
    console.warn('[CertExpiryMonitor] No targets configured. Set CERT_MONITOR_TARGETS.');
    return { checked: 0, alerts: 0, failures: 0, results: [] };
  }

  const results: CertCheckResult[] = [];
  let failures = 0;

  for (const target of targets) {
    try {
      const result = await fetcher({
        ...target,
        daysBeforeAlert: target.daysBeforeAlert ?? threshold,
      });
      results.push(result);
      logResult(result);
    } catch (error) {
      failures++;
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[CertExpiryMonitor] Failed to check ${target.host}: ${message}`);
      results.push({
        host: target.host,
        port: target.port ?? 443,
        name: target.name,
        valid: false,
        message,
        alert: true,
      });
    }
  }

  const alerts = results.filter(result => result.alert).length;

  return {
    checked: targets.length,
    alerts,
    failures,
    results,
  };
}

function loadTargetsFromEnv(): CertTarget[] {
  const raw = process.env.CERT_MONITOR_TARGETS;
  if (!raw) {
    return [
      { host: 'demo.vitalcv.com', port: 443, name: 'demo' },
      { host: 'stage.vitalcv.com', port: 443, name: 'stage' },
    ];
  }

  return raw
    .split('|')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      const [hostPort, name] = entry.split(',');
      const [host, portStr] = hostPort.split(':');
      return {
        host,
        port: portStr ? parseInt(portStr, 10) : 443,
        name: name?.trim(),
      };
    });
}

async function fetchCertificateMetadata(target: CertTarget): Promise<CertCheckResult> {
  const port = target.port ?? 443;
  const alertWindow = target.daysBeforeAlert ?? DEFAULT_THRESHOLD;

  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host: target.host,
        port,
        servername: target.host,
        rejectUnauthorized: false,
        timeout: 10000,
      },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();

        if (!cert || Object.keys(cert).length === 0) {
          return resolve({
            host: target.host,
            port,
            name: target.name,
            valid: false,
            message: 'No peer certificate returned',
            alert: true,
          });
        }

        const expiresAt = cert.valid_to ? new Date(cert.valid_to).toISOString() : undefined;
        const daysRemaining = cert.valid_to ? daysUntil(cert.valid_to) : undefined;
        const alert = typeof daysRemaining === 'number' ? daysRemaining <= alertWindow : true;

        resolve({
          host: target.host,
          port,
          name: target.name,
          expiresAt,
          daysRemaining,
          valid: true,
          message: daysRemaining !== undefined
            ? `Certificate valid for ${daysRemaining} more day(s)`
            : 'Unable to read certificate expiration',
          alert,
        });
      }
    );

    socket.on('error', (error) => {
      socket.destroy();
      reject(error);
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('TLS connection timed out'));
    });
  });
}

function daysUntil(validTo: string): number {
  const expires = Date.parse(validTo);
  if (Number.isNaN(expires)) {
    return Number.NaN;
  }
  return Math.floor((expires - Date.now()) / (1000 * 60 * 60 * 24));
}

function logResult(result: CertCheckResult): void {
  const label = result.name ? `${result.name} (${result.host})` : result.host;
  if (!result.valid) {
    console.warn(`[CertExpiryMonitor] ${label}: ${result.message}`);
    return;
  }

  const alertLabel = result.alert ? 'ALERT' : 'OK';
  console.log(
    `[CertExpiryMonitor] ${alertLabel} ${label} -> expires ${result.expiresAt ?? 'unknown'} (${result.daysRemaining ?? '?'} days)`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCertExpiryMonitor()
    .then(summary => {
      console.log(
        `[CertExpiryMonitor] Completed. Checked=${summary.checked}, alerts=${summary.alerts}, failures=${summary.failures}`
      );
      if (summary.alerts > 0 || summary.failures > 0) {
        process.exitCode = 1;
      }
    })
    .catch(error => {
      console.error('[CertExpiryMonitor] Fatal error:', error);
      process.exitCode = 1;
    });
}

