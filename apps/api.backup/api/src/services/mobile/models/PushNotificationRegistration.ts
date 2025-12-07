import { PrismaClient, PushNotificationRegistration, PushPlatform } from '@prisma/client';

export interface PushRegistrationInput {
  userId: string;
  deviceId: string;
  platform: PushPlatform;
  token: string;
  enabled?: boolean;
}

/**
 * PushNotificationRegistration service for managing device tokens
 */
export class PushNotificationRegistrationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Register or update a device token
   */
  async register(input: PushRegistrationInput): Promise<PushNotificationRegistration> {
    const { userId, deviceId, platform, token, enabled = true } = input;

    return this.prisma.pushNotificationRegistration.upsert({
      where: {
        userId_deviceId_platform: {
          userId,
          deviceId,
          platform,
        },
      },
      create: {
        userId,
        deviceId,
        platform,
        token,
        enabled,
      },
      update: {
        token,
        enabled,
      },
    });
  }

  /**
   * Get registration by unique identifier
   */
  async get(userId: string, deviceId: string, platform: PushPlatform): Promise<PushNotificationRegistration | null> {
    return this.prisma.pushNotificationRegistration.findUnique({
      where: {
        userId_deviceId_platform: {
          userId,
          deviceId,
          platform,
        },
      },
    });
  }

  /**
   * Get all registrations for a user
   */
  async getByUser(userId: string): Promise<PushNotificationRegistration[]> {
    return this.prisma.pushNotificationRegistration.findMany({
      where: { userId },
    });
  }

  /**
   * Get all enabled registrations for a user
   */
  async getEnabledByUser(userId: string): Promise<PushNotificationRegistration[]> {
    return this.prisma.pushNotificationRegistration.findMany({
      where: {
        userId,
        enabled: true,
      },
    });
  }

  /**
   * Get all registrations by platform
   */
  async getByPlatform(platform: PushPlatform, enabledOnly: boolean = true): Promise<PushNotificationRegistration[]> {
    const where: any = { platform };
    if (enabledOnly) {
      where.enabled = true;
    }

    return this.prisma.pushNotificationRegistration.findMany({ where });
  }

  /**
   * Enable or disable a registration
   */
  async setEnabled(userId: string, deviceId: string, platform: PushPlatform, enabled: boolean): Promise<PushNotificationRegistration> {
    return this.prisma.pushNotificationRegistration.update({
      where: {
        userId_deviceId_platform: {
          userId,
          deviceId,
          platform,
        },
      },
      data: { enabled },
    });
  }

  /**
   * Delete a registration
   */
  async unregister(userId: string, deviceId: string, platform: PushPlatform): Promise<void> {
    await this.prisma.pushNotificationRegistration.delete({
      where: {
        userId_deviceId_platform: {
          userId,
          deviceId,
          platform,
        },
      },
    });
  }

  /**
   * Delete all registrations for a user
   */
  async unregisterAll(userId: string): Promise<number> {
    const result = await this.prisma.pushNotificationRegistration.deleteMany({
      where: { userId },
    });
    return result.count;
  }

  /**
   * Get count of registrations
   */
  async count(userId?: string, platform?: PushPlatform): Promise<number> {
    const where: any = {};
    if (userId) {
      where.userId = userId;
    }
    if (platform) {
      where.platform = platform;
    }

    return this.prisma.pushNotificationRegistration.count({ where });
  }
}

