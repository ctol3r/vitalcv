/**
 * COMP-001: Data Classification and Tagging Service
 *
 * Provides centralized functions to set and query data classification tags
 * on entities (Credential, AuditEvent, Candidate, Organization).
 *
 * Classification schema:
 * {
 *   sensitivity: "public" | "professional" | "regulatory" | "PHI",
 *   complianceDomains: ["HIPAA", "GDPR", "NCQA", ...],
 *   tags: string[]
 * }
 */

import { PrismaClient } from '@prisma/client';

export type SensitivityLevel = 'public' | 'professional' | 'regulatory' | 'PHI';
export type ComplianceDomain = 'HIPAA' | 'GDPR' | 'NCQA' | 'SOC2' | 'HITRUST' | 'TJC';

export interface DataClassification {
  sensitivity?: SensitivityLevel;
  complianceDomains?: ComplianceDomain[];
  tags?: string[];
}

export class ClassificationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Set classification on a Credential
   */
  async setCredentialClassification(
    credentialId: string,
    classification: DataClassification
  ): Promise<void> {
    await this.prisma.credential.update({
      where: { id: credentialId },
      data: { classification: classification as any },
    });
  }

  /**
   * Get classification from a Credential
   */
  async getCredentialClassification(
    credentialId: string
  ): Promise<DataClassification | null> {
    const credential = await this.prisma.credential.findUnique({
      where: { id: credentialId },
      select: { classification: true },
    });
    return (credential?.classification as DataClassification) || null;
  }

  /**
   * Set classification on an AuditEvent
   */
  async setAuditEventClassification(
    eventId: string,
    classification: DataClassification
  ): Promise<void> {
    await this.prisma.auditEvent.update({
      where: { id: eventId },
      data: { classification: classification as any },
    });
  }

  /**
   * Get classification from an AuditEvent
   */
  async getAuditEventClassification(
    eventId: string
  ): Promise<DataClassification | null> {
    const event = await this.prisma.auditEvent.findUnique({
      where: { id: eventId },
      select: { classification: true },
    });
    return (event?.classification as DataClassification) || null;
  }

  /**
   * Set classification on a Candidate
   */
  async setCandidateClassification(
    candidateId: string,
    classification: DataClassification
  ): Promise<void> {
    await this.prisma.candidate.update({
      where: { id: candidateId },
      data: { classification: classification as any },
    });
  }

  /**
   * Get classification from a Candidate
   */
  async getCandidateClassification(
    candidateId: string
  ): Promise<DataClassification | null> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { classification: true },
    });
    return (candidate?.classification as DataClassification) || null;
  }

  /**
   * Set classification on an Organization
   */
  async setOrganizationClassification(
    orgId: string,
    classification: DataClassification
  ): Promise<void> {
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { classification: classification as any },
    });
  }

  /**
   * Get classification from an Organization
   */
  async getOrganizationClassification(
    orgId: string
  ): Promise<DataClassification | null> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { classification: true },
    });
    return (org?.classification as DataClassification) || null;
  }

  /**
   * Query credentials by classification criteria
   */
  async queryCredentialsByClassification(criteria: {
    sensitivity?: SensitivityLevel;
    complianceDomain?: ComplianceDomain;
    tag?: string;
  }) {
    const credentials = await this.prisma.credential.findMany({
      where: {
        classification: {
          path: [],
          not: null,
        },
      },
    });

    return credentials.filter((cred) => {
      const classification = cred.classification as DataClassification | null;
      if (!classification) return false;

      if (criteria.sensitivity && classification.sensitivity !== criteria.sensitivity) {
        return false;
      }

      if (
        criteria.complianceDomain &&
        !classification.complianceDomains?.includes(criteria.complianceDomain)
      ) {
        return false;
      }

      if (criteria.tag && !classification.tags?.includes(criteria.tag)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Query audit events by classification criteria
   */
  async queryAuditEventsByClassification(criteria: {
    sensitivity?: SensitivityLevel;
    complianceDomain?: ComplianceDomain;
    tag?: string;
  }) {
    const events = await this.prisma.auditEvent.findMany({
      where: {
        classification: {
          path: [],
          not: null,
        },
      },
    });

    return events.filter((event) => {
      const classification = event.classification as DataClassification | null;
      if (!classification) return false;

      if (criteria.sensitivity && classification.sensitivity !== criteria.sensitivity) {
        return false;
      }

      if (
        criteria.complianceDomain &&
        !classification.complianceDomains?.includes(criteria.complianceDomain)
      ) {
        return false;
      }

      if (criteria.tag && !classification.tags?.includes(criteria.tag)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Merge classification tags (useful for incremental updates)
   */
  mergeClassification(
    existing: DataClassification | null,
    updates: DataClassification
  ): DataClassification {
    return {
      sensitivity: updates.sensitivity || existing?.sensitivity,
      complianceDomains: [
        ...(existing?.complianceDomains || []),
        ...(updates.complianceDomains || []),
      ].filter((v, i, a) => a.indexOf(v) === i), // dedupe
      tags: [
        ...(existing?.tags || []),
        ...(updates.tags || []),
      ].filter((v, i, a) => a.indexOf(v) === i), // dedupe
    };
  }

  /**
   * Check if classification contains PHI
   */
  containsPHI(classification: DataClassification | null): boolean {
    return classification?.sensitivity === 'PHI' ||
           classification?.complianceDomains?.includes('HIPAA') ||
           false;
  }

  /**
   * Check if classification requires specific compliance domain
   */
  requiresComplianceDomain(
    classification: DataClassification | null,
    domain: ComplianceDomain
  ): boolean {
    return classification?.complianceDomains?.includes(domain) || false;
  }
}

