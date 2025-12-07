/**
 * B150A-DSAR-004: Erasure engine - soft-delete & anonymize subject across core tables
 *
 * Given a subjectId and scope, this engine:
 * - NULLs/obfuscates direct identifiers (name, email, phone)
 * - Decouples foreign keys
 * - Preserves aggregated metrics & audit hashes
 * - Handles different scopes: ACCOUNT, IDENTIFIERS, ALL
 */

import { PrismaClient } from '@prisma/client';
import {
  anonymizeName,
  anonymizeEmail,
  anonymizePhone,
  anonymizeDid,
  anonymizeNpi,
  anonymizeFreeText,
  hashForAudit,
} from './anonymize';

export type ErasureScope = 'ACCOUNT' | 'IDENTIFIERS' | 'ALL';

export interface ErasureResult {
  subjectId: string;
  scope: ErasureScope;
  tablesProcessed: string[];
  recordsAnonymized: number;
  recordsDecoupled: number;
  errors: Array<{ table: string; error: string }>;
  completedAt: Date;
}

export class ErasureEngine {
  constructor(private prisma: PrismaClient) {}

  /**
   * Execute erasure for a subject
   */
  async executeErasure(
    subjectId: string,
    scope: ErasureScope,
    seed?: string
  ): Promise<ErasureResult> {
    const result: ErasureResult = {
      subjectId,
      scope,
      tablesProcessed: [],
      recordsAnonymized: 0,
      recordsDecoupled: 0,
      errors: [],
      completedAt: new Date(),
    };

    try {
      // Find the user first
      const user = await this.prisma.user.findUnique({
        where: { id: subjectId },
        include: {
          npiClaims: true,
          credentials: true,
          jobs: true,
        },
      });

      if (!user) {
        throw new Error(`User not found: ${subjectId}`);
      }

      // Process based on scope
      switch (scope) {
        case 'IDENTIFIERS':
          await this.anonymizeIdentifiers(user.id, seed, result);
          break;
        case 'ACCOUNT':
          await this.anonymizeAccount(user.id, seed, result);
          break;
        case 'ALL':
          await this.anonymizeAll(user.id, seed, result);
          break;
      }

      result.completedAt = new Date();
      return result;
    } catch (error: any) {
      result.errors.push({
        table: 'general',
        error: error.message || 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Anonymize only direct identifiers (name, email, phone)
   * Preserves relationships and foreign keys
   */
  private async anonymizeIdentifiers(
    userId: string,
    seed: string | undefined,
    result: ErasureResult
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return;
    }

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          name: anonymizeName(user.name, seed),
          email: anonymizeEmail(user.email, seed),
          phone: user.phone ? anonymizePhone(user.phone, seed) : null,
          did: user.did ? anonymizeDid(user.did, seed) : null,
        },
      });

      result.tablesProcessed.push('User');
      result.recordsAnonymized += 1;

      // Anonymize NPI claims
      const npiClaims = await this.prisma.npiClaim.findMany({
        where: { userId },
      });

      for (const claim of npiClaims) {
        await this.prisma.npiClaim.update({
          where: { id: claim.id },
          data: {
            npi: anonymizeNpi(claim.npi, seed),
          },
        });
        result.recordsAnonymized += 1;
      }

      if (npiClaims.length > 0) {
        result.tablesProcessed.push('NpiClaim');
      }
    } catch (error: any) {
      result.errors.push({
        table: 'User/NpiClaim',
        error: error.message || 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Anonymize account data including identifiers
   * Decouples some foreign keys but preserves audit trails
   */
  private async anonymizeAccount(
    userId: string,
    seed: string | undefined,
    result: ErasureResult
  ): Promise<void> {
    // First anonymize identifiers
    await this.anonymizeIdentifiers(userId, seed, result);

    try {
      // Anonymize credentials (preserve structure, remove PII)
      const credentials = await this.prisma.credential.findMany({
        where: { userId },
      });

      for (const cred of credentials) {
        await this.prisma.credential.update({
          where: { id: cred.id },
          data: {
            name: anonymizeFreeText(cred.name),
            issuer: cred.issuer ? anonymizeFreeText(cred.issuer) : null,
            holderDid: cred.holderDid ? anonymizeDid(cred.holderDid, seed) : null,
            // Preserve credHash for audit trail
          },
        });
        result.recordsAnonymized += 1;
      }

      if (credentials.length > 0) {
        result.tablesProcessed.push('Credential');
      }

      // Anonymize jobs (preserve structure)
      const jobs = await this.prisma.job.findMany({
        where: { userId },
      });

      for (const job of jobs) {
        await this.prisma.job.update({
          where: { id: job.id },
          data: {
            title: anonymizeFreeText(job.title || ''),
            description: job.description ? anonymizeFreeText(job.description) : null,
          },
        });
        result.recordsAnonymized += 1;
      }

      if (jobs.length > 0) {
        result.tablesProcessed.push('Job');
      }
    } catch (error: any) {
      result.errors.push({
        table: 'Credential/Job',
        error: error.message || 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Anonymize all data - most aggressive erasure
   * Decouples foreign keys while preserving audit hashes
   */
  private async anonymizeAll(
    userId: string,
    seed: string | undefined,
    result: ErasureResult
  ): Promise<void> {
    // First anonymize account
    await this.anonymizeAccount(userId, seed, result);

    try {
      // Decouple foreign keys in related tables
      // Set foreign keys to NULL where possible, or anonymize identifiers

      // Handle Application records
      const applications = await this.prisma.application.findMany({
        where: { applicantDid: userId }, // Assuming applicantDid can reference user
      });

      for (const app of applications) {
        // Decouple by setting to anonymized DID
        await this.prisma.application.update({
          where: { id: app.id },
          data: {
            applicantDid: anonymizeDid(userId, seed),
          },
        });
        result.recordsDecoupled += 1;
      }

      if (applications.length > 0) {
        result.tablesProcessed.push('Application');
      }

      // Handle PrivilegeRequest records
      const privilegeRequests = await this.prisma.privilegeRequest.findMany({
        where: { clinicianDid: userId },
      });

      for (const req of privilegeRequests) {
        await this.prisma.privilegeRequest.update({
          where: { id: req.id },
          data: {
            clinicianDid: anonymizeDid(userId, seed),
          },
        });
        result.recordsDecoupled += 1;
      }

      if (privilegeRequests.length > 0) {
        result.tablesProcessed.push('PrivilegeRequest');
      }

      // Handle AuditEvent records - preserve structure but anonymize subject references
      const auditEvents = await this.prisma.auditEvent.findMany({
        where: {
          OR: [
            { userId },
            { subjectNpi: { not: null } }, // May reference user via NPI
          ],
        },
      });

      for (const event of auditEvents) {
        // Preserve audit hash but anonymize data content
        const anonymizedData = event.data ? anonymizeFreeText(JSON.stringify(event.data)) : {};

        await this.prisma.auditEvent.update({
          where: { id: event.id },
          data: {
            userId: event.userId === userId ? anonymizeDid(userId, seed) : event.userId,
            subjectNpi: event.subjectNpi ? anonymizeNpi(event.subjectNpi, seed) : null,
            data: anonymizedData as any,
            // Preserve chainTxHash for audit integrity
          },
        });
        result.recordsAnonymized += 1;
      }

      if (auditEvents.length > 0) {
        result.tablesProcessed.push('AuditEvent');
      }

      // Handle PayerEnrollment records
      const enrollments = await this.prisma.payerEnrollment.findMany({
        where: { clinicianDid: userId },
      });

      for (const enrollment of enrollments) {
        await this.prisma.payerEnrollment.update({
          where: { id: enrollment.id },
          data: {
            clinicianDid: anonymizeDid(userId, seed),
            caqhId: enrollment.caqhId ? anonymizeFreeText(enrollment.caqhId) : null,
            pecosId: enrollment.pecosId ? anonymizeFreeText(enrollment.pecosId) : null,
          },
        });
        result.recordsAnonymized += 1;
      }

      if (enrollments.length > 0) {
        result.tablesProcessed.push('PayerEnrollment');
      }

      // Handle Notification records
      const notifications = await this.prisma.notification.findMany({
        where: { userId },
      });

      for (const notification of notifications) {
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: {
            payload: anonymizeFreeText(JSON.stringify(notification.payload)) as any,
          },
        });
        result.recordsAnonymized += 1;
      }

      if (notifications.length > 0) {
        result.tablesProcessed.push('Notification');
      }
    } catch (error: any) {
      result.errors.push({
        table: 'RelatedTables',
        error: error.message || 'Unknown error',
      });
      throw error;
    }
  }
}

