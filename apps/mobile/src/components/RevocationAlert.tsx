/**
 * RevocationAlert.tsx — Wave 62: Push Notification Alerts
 *
 * Handles revocation and expiration alerts via expo-notifications.
 *
 * Triggers:
 *   - Credential expired
 *   - Credential revoked
 *   - CRS score degraded
 */

// ── Types ─────────────────────────────────────────────────────────────────

export interface RevocationAlertConfig {
  npi: string;
  pollIntervalMs: number;
  baseUrl: string;
}

export interface AlertEvent {
  type: 'expired' | 'revoked' | 'degraded';
  credentialId?: string;
  credentialSource?: string;
  previousScore?: number;
  newScore?: number;
  timestamp: string;
}

// ── Alert Check Logic ─────────────────────────────────────────────────────

export async function checkForAlerts(
  npi: string,
  baseUrl: string,
  previousCrsScore: number,
): Promise<AlertEvent[]> {
  const alerts: AlertEvent[] = [];

  try {
    const res = await fetch(`${baseUrl}/api/graph/explorer/${npi}`);
    if (!res.ok) return alerts;

    const data = (await res.json()) as {
      crs: { overallScore: number };
      credentials: Array<{ id: string; source: string; status: string; expiresAt: string | null }>;
    };

    // Check CRS degradation
    if (data.crs.overallScore < previousCrsScore - 5) {
      alerts.push({
        type: 'degraded',
        previousScore: previousCrsScore,
        newScore: data.crs.overallScore,
        timestamp: new Date().toISOString(),
      });
    }

    // Check credential status
    for (const cred of data.credentials) {
      if (cred.status === 'REVOKED') {
        alerts.push({
          type: 'revoked',
          credentialId: cred.id,
          credentialSource: cred.source,
          timestamp: new Date().toISOString(),
        });
      }

      if (cred.expiresAt) {
        const expiresMs = new Date(cred.expiresAt).getTime();
        const daysUntilExpiry = (expiresMs - Date.now()) / (1000 * 60 * 60 * 24);
        if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
          alerts.push({
            type: 'expired',
            credentialId: cred.id,
            credentialSource: cred.source,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  } catch {
    // Silent fail — will retry on next poll
  }

  return alerts;
}

/**
 * Schedule push notification (Expo)
 *
 * Usage:
 *   import * as Notifications from 'expo-notifications';
 *   await Notifications.scheduleNotificationAsync({
 *     content: {
 *       title: alert.type === 'revoked' ? '⚡ Credential Revoked' : '⏰ Credential Expiring',
 *       body: `${alert.credentialSource} requires attention`,
 *     },
 *     trigger: null, // immediate
 *   });
 */
export const NOTIFICATION_CHANNEL = 'vitalcv-alerts';
