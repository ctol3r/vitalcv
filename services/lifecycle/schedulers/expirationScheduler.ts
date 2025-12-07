/**
 * B238A-LIFE-003: ExpirationScheduler
 *
 * Regularly checks credentials for nearing expiry based on CredentialExpiryPolicy.
 * Schedules notifications and auto-renewals with configurable lead time.
 */

import { PrismaClient } from '@prisma/client';
import { CredentialExpiryPolicy } from '../models/CredentialExpiryPolicy.js';

export interface ExpirationCheckResult {
  credentialId: string;
  credentialType: string;
  daysUntilExpiry: number;
  isExpired: boolean;
  isInGracePeriod: boolean;
  shouldNotify: boolean;
  shouldAutoRenew: boolean;
  policy?: CredentialExpiryPolicy;
}

export interface ExpirationSchedulerConfig {
  /**
   * Lead time in days before expiry to start checking
   * Default: 30 days
   */
  notificationLeadTime?: number;

  /**
   * Lead time in days before expiry to trigger auto-renewal
   * Default: 7 days
   */
  autoRenewalLeadTime?: number;

  /**
   * Interval in milliseconds for running expiration checks
   * Default: 1 hour (3600000ms)
   */
  checkInterval?: number;
}

export class ExpirationScheduler {
  private prisma: PrismaClient;
  private config: Required<ExpirationSchedulerConfig>;
  private intervalId?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor(prisma: PrismaClient, config: ExpirationSchedulerConfig = {}) {
    this.prisma = prisma;
    this.config = {
      notificationLeadTime: config.notificationLeadTime ?? 30,
      autoRenewalLeadTime: config.autoRenewalLeadTime ?? 7,
      checkInterval: config.checkInterval ?? 3600000, // 1 hour default
    };
  }

  /**
   * Start the expiration scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.warn('ExpirationScheduler is already running');
      return;
    }

    this.isRunning = true;
    console.log(`Starting ExpirationScheduler with interval ${this.config.checkInterval}ms`);

    // Run immediately on start
    this.checkExpirations().catch((err) => {
      console.error('Error in initial expiration check:', err);
    });

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.checkExpirations().catch((err) => {
        console.error('Error in expiration check:', err);
      });
    }, this.config.checkInterval);
  }

  /**
   * Stop the expiration scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    console.log('ExpirationScheduler stopped');
  }

  /**
   * Check all credentials for expiration
   */
  async checkExpirations(): Promise<ExpirationCheckResult[]> {
    const results: ExpirationCheckResult[] = [];

    try {
      // Get all active credentials with expiry dates
      const credentials = await this.prisma.credential.findMany({
        where: {
          status: 'active',
          expiresAt: {
            not: null,
          },
        },
        select: {
          id: true,
          type: true,
          expiresAt: true,
        },
      });

      // Get all expiry policies
      const policies = await this.prisma.credentialExpiryPolicy.findMany();
      const policyMap = new Map(policies.map((p) => [p.credentialType, p]));

      const now = new Date();

      for (const credential of credentials) {
        if (!credential.expiresAt) continue;

        const expiryDate = new Date(credential.expiresAt);
        const daysUntilExpiry = Math.ceil(
          (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        const policy = policyMap.get(credential.type);
        const gracePeriod = policy?.gracePeriod ?? 0;
        const isExpired = daysUntilExpiry < 0;
        const isInGracePeriod = isExpired && Math.abs(daysUntilExpiry) <= gracePeriod;

        const shouldNotify =
          daysUntilExpiry <= this.config.notificationLeadTime && daysUntilExpiry >= -gracePeriod;

        const shouldAutoRenew =
          daysUntilExpiry <= this.config.autoRenewalLeadTime &&
          daysUntilExpiry >= -gracePeriod;

        results.push({
          credentialId: credential.id,
          credentialType: credential.type,
          daysUntilExpiry,
          isExpired,
          isInGracePeriod,
          shouldNotify,
          shouldAutoRenew,
          policy: policy
            ? {
                id: policy.id,
                credentialType: policy.credentialType,
                defaultValidityPeriod: policy.defaultValidityPeriod,
                gracePeriod: policy.gracePeriod,
                renewalRequirements: policy.renewalRequirements as any,
                createdAt: policy.createdAt,
                updatedAt: policy.updatedAt,
              }
            : undefined,
        });
      }

      console.log(`ExpirationScheduler: Checked ${credentials.length} credentials, found ${results.length} needing attention`);
    } catch (error) {
      console.error('Error checking expirations:', error);
      throw error;
    }

    return results;
  }

  /**
   * Check a specific credential for expiration
   */
  async checkCredentialExpiration(credentialId: string): Promise<ExpirationCheckResult | null> {
    const credential = await this.prisma.credential.findUnique({
      where: { id: credentialId },
      select: {
        id: true,
        type: true,
        expiresAt: true,
        status: true,
      },
    });

    if (!credential || credential.status !== 'active' || !credential.expiresAt) {
      return null;
    }

    const policy = await this.prisma.credentialExpiryPolicy.findUnique({
      where: { credentialType: credential.type },
    });

    const now = new Date();
    const expiryDate = new Date(credential.expiresAt);
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    const gracePeriod = policy?.gracePeriod ?? 0;
    const isExpired = daysUntilExpiry < 0;
    const isInGracePeriod = isExpired && Math.abs(daysUntilExpiry) <= gracePeriod;

    const shouldNotify =
      daysUntilExpiry <= this.config.notificationLeadTime && daysUntilExpiry >= -gracePeriod;

    const shouldAutoRenew =
      daysUntilExpiry <= this.config.autoRenewalLeadTime && daysUntilExpiry >= -gracePeriod;

    return {
      credentialId: credential.id,
      credentialType: credential.type,
      daysUntilExpiry,
      isExpired,
      isInGracePeriod,
      shouldNotify,
      shouldAutoRenew,
      policy: policy
        ? {
            id: policy.id,
            credentialType: policy.credentialType,
            defaultValidityPeriod: policy.defaultValidityPeriod,
            gracePeriod: policy.gracePeriod,
            renewalRequirements: policy.renewalRequirements as any,
            createdAt: policy.createdAt,
            updatedAt: policy.updatedAt,
          }
        : undefined,
    };
  }

  /**
   * Get credentials expiring within a time window
   */
  async getCredentialsExpiringIn(
    days: number,
    credentialType?: string
  ): Promise<ExpirationCheckResult[]> {
    const allResults = await this.checkExpirations();
    return allResults.filter(
      (r) =>
        r.daysUntilExpiry <= days &&
        r.daysUntilExpiry >= -days &&
        (!credentialType || r.credentialType === credentialType)
    );
  }
}

