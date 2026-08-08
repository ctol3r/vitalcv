import * as Notifications from 'expo-notifications';

import type { StoredCredential } from './LocalCredentialStore';

export type NotificationType =
  | 'credential_expiring'
  | 'credential_expired'
  | 'sanction_alert'
  | 'license_renewal'
  | 'trust_state_updated';

type NotificationPayload = Record<string, string | number | boolean>;

type NotificationAdapter = Pick<
  typeof Notifications,
  | 'cancelAllScheduledNotificationsAsync'
  | 'getPermissionsAsync'
  | 'requestPermissionsAsync'
  | 'scheduleNotificationAsync'
  | 'setNotificationChannelAsync'
>;

export class NotificationService {
  private channelConfigured = false;

  constructor(private readonly notifications: NotificationAdapter = Notifications) {}

  private async ensurePermissions(): Promise<boolean> {
    const permissions = await this.notifications.getPermissionsAsync();

    if (permissions.granted) {
      return true;
    }

    const requested = await this.notifications.requestPermissionsAsync();
    return requested.granted;
  }

  private async ensureAndroidChannel(): Promise<void> {
    if (this.channelConfigured) {
      return;
    }

    await this.notifications.setNotificationChannelAsync('credential-alerts', {
      name: 'Credential Alerts',
      importance: Notifications.AndroidImportance.HIGH,
    });

    this.channelConfigured = true;
  }

  async scheduleCredentialExpiryReminders(credentials: StoredCredential[]): Promise<void> {
    if (!(await this.ensurePermissions())) {
      return;
    }

    await this.ensureAndroidChannel();

    const offsets = [90, 30, 7];
    const now = Date.now();

    for (const credential of credentials) {
      if (!credential.expiresAt) {
        continue;
      }

      const expiry = new Date(credential.expiresAt);
      if (Number.isNaN(expiry.getTime())) {
        continue;
      }

      for (const daysBefore of offsets) {
        const reminderDate = new Date(expiry.getTime() - daysBefore * 86_400_000);
        if (reminderDate.getTime() <= now) {
          continue;
        }

        await this.notifications.scheduleNotificationAsync({
          content: {
            title: `${credential.type} expires in ${daysBefore} days`,
            body: `${credential.issuer} credential ${credential.id} expires on ${expiry.toDateString()}.`,
            data: {
              type: 'credential_expiring',
              credentialId: credential.id,
              daysBefore,
            },
          },
          // `type` is load-bearing, not decoration. Without it this object is
          // structurally a ChannelAwareTriggerInput — which expo-notifications
          // documents as "delivered immediately" — and `parseDateTrigger`
          // (which requires type === DATE) never matches, so `date` is silently
          // discarded and every reminder fires at once. TypeScript cannot catch
          // the omission: NotificationTriggerInput is a union, and `date`
          // survives excess-property checking because DateTriggerInput declares
          // it. Covered by NotificationService.test.ts.
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            channelId: 'credential-alerts',
            date: reminderDate,
          },
        });
      }
    }
  }

  async sendImmediateAlert(
    type: Exclude<NotificationType, 'credential_expiring'>,
    title: string,
    body: string,
    data: NotificationPayload = {},
  ): Promise<void> {
    if (!(await this.ensurePermissions())) {
      return;
    }

    await this.ensureAndroidChannel();

    await this.notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          type,
          ...data,
        },
      },
      trigger: null,
    });
  }

  async cancelAll(): Promise<void> {
    await this.notifications.cancelAllScheduledNotificationsAsync();
  }
}

export const notificationService = new NotificationService();
