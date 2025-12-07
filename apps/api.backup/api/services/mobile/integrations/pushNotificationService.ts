/**
 * PushNotificationService Integration
 *
 * Integrates with push services (e.g. Firebase Cloud Messaging, APNs) to send notifications:
 * - Methods to send targeted notifications
 * - Unit tests with stubs
 */

export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
  priority?: 'high' | 'normal';
  ttl?: number; // Time to live in seconds
}

export interface PushTarget {
  deviceToken: string;
  platform: 'ios' | 'android' | 'web';
  userId?: string;
}

export interface PushResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface PushServiceConfig {
  fcmServerKey?: string;
  apnsKeyId?: string;
  apnsTeamId?: string;
  apnsBundleId?: string;
  apnsKeyPath?: string;
}

/**
 * Push notification service integration
 */
export class PushNotificationService {
  private config: PushServiceConfig;

  constructor(config: PushServiceConfig = {}) {
    this.config = config;
  }

  /**
   * Send a push notification to a single device
   */
  async sendNotification(
    target: PushTarget,
    notification: PushNotification,
  ): Promise<PushResult> {
    try {
      switch (target.platform) {
        case 'ios':
          return await this.sendAPNS(target, notification);
        case 'android':
        case 'web':
          return await this.sendFCM(target, notification);
        default:
          throw new Error(`Unsupported platform: ${target.platform}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send push notifications to multiple devices
   */
  async sendBulkNotifications(
    targets: PushTarget[],
    notification: PushNotification,
  ): Promise<PushResult[]> {
    return Promise.all(
      targets.map((target) => this.sendNotification(target, notification)),
    );
  }

  /**
   * Send notification to a user (all their devices)
   */
  async sendToUser(
    userId: string,
    notification: PushNotification,
    platforms?: ('ios' | 'android' | 'web')[],
  ): Promise<PushResult[]> {
    // Stub: In production, fetch user's device tokens from database
    const userDevices: PushTarget[] = [
      // Mock devices
      {
        deviceToken: `token_${userId}_ios`,
        platform: 'ios',
        userId,
      },
      {
        deviceToken: `token_${userId}_android`,
        platform: 'android',
        userId,
      },
    ];

    const filteredDevices = platforms
      ? userDevices.filter((d) => platforms.includes(d.platform))
      : userDevices;

    return this.sendBulkNotifications(filteredDevices, notification);
  }

  /**
   * Send notification for new messages
   */
  async sendNewMessageNotification(
    target: PushTarget,
    message: {
      from: string;
      preview: string;
      messageId: string;
    },
  ): Promise<PushResult> {
    return this.sendNotification(target, {
      title: 'New Message',
      body: `${message.from}: ${message.preview}`,
      data: {
        type: 'message',
        messageId: message.messageId,
        from: message.from,
      },
      priority: 'high',
      sound: 'default',
    });
  }

  /**
   * Send notification for reminders
   */
  async sendReminderNotification(
    target: PushTarget,
    reminder: {
      title: string;
      description: string;
      reminderId: string;
      dueAt: Date;
    },
  ): Promise<PushResult> {
    return this.sendNotification(target, {
      title: reminder.title,
      body: reminder.description,
      data: {
        type: 'reminder',
        reminderId: reminder.reminderId,
        dueAt: reminder.dueAt.toISOString(),
      },
      priority: 'normal',
      sound: 'default',
    });
  }

  /**
   * Send FCM notification (Firebase Cloud Messaging)
   */
  private async sendFCM(
    target: PushTarget,
    notification: PushNotification,
  ): Promise<PushResult> {
    if (!this.config.fcmServerKey) {
      // Stub implementation
      console.log('[FCM Stub] Sending notification:', {
        token: target.deviceToken,
        notification,
      });
      return {
        success: true,
        messageId: `fcm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      };
    }

    // Real FCM implementation would use:
    // const admin = require('firebase-admin');
    // const message = {
    //   notification: {
    //     title: notification.title,
    //     body: notification.body,
    //   },
    //   data: notification.data,
    //   token: target.deviceToken,
    //   android: { priority: notification.priority === 'high' ? 'high' : 'normal' },
    //   apns: { payload: { aps: { sound: notification.sound || 'default' } } },
    // };
    // const response = await admin.messaging().send(message);

    throw new Error('FCM not fully implemented - requires firebase-admin');
  }

  /**
   * Send APNS notification (Apple Push Notification Service)
   */
  private async sendAPNS(
    target: PushTarget,
    notification: PushNotification,
  ): Promise<PushResult> {
    if (!this.config.apnsKeyId || !this.config.apnsTeamId) {
      // Stub implementation
      console.log('[APNS Stub] Sending notification:', {
        token: target.deviceToken,
        notification,
      });
      return {
        success: true,
        messageId: `apns_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      };
    }

    // Real APNS implementation would use:
    // const apn = require('apn');
    // const provider = new apn.Provider({
    //   token: {
    //     key: this.config.apnsKeyPath,
    //     keyId: this.config.apnsKeyId,
    //     teamId: this.config.apnsTeamId,
    //   },
    //   production: process.env.NODE_ENV === 'production',
    // });
    // const apnNotification = new apn.Notification({
    //   alert: { title: notification.title, body: notification.body },
    //   sound: notification.sound || 'default',
    //   badge: notification.badge,
    //   payload: notification.data,
    //   topic: this.config.apnsBundleId,
    //   priority: notification.priority === 'high' ? 10 : 5,
    // });
    // const result = await provider.send(apnNotification, target.deviceToken);

    throw new Error('APNS not fully implemented - requires apn package');
  }

  /**
   * Validate device token format
   */
  validateDeviceToken(token: string, platform: 'ios' | 'android' | 'web'): boolean {
    if (!token || token.length < 10) {
      return false;
    }

    switch (platform) {
      case 'ios':
        // APNS tokens are typically 64 characters hex
        return /^[0-9a-f]{64}$/i.test(token);
      case 'android':
      case 'web':
        // FCM tokens are longer and can contain various characters
        return token.length > 100 && token.length < 2000;
      default:
        return false;
    }
  }
}

export const pushNotificationService = new PushNotificationService();

