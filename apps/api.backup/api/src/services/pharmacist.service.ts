/**
 * Pharmacist Credential Service
 *
 * Manages pharmacist-specific credentials:
 * - NAPLEX (post-May 1, 2025 new outline)
 * - MPJE (state-specific until Uniform MPJE 2026)
 * - CAQH re-attestation (120-day default, 180 for IL)
 * - PECOS revalidation (5yr provider / 3yr DMEPOS)
 */

export interface PharmacistCredential {
  id: string;
  userId: string;
  naplexVersion: 'pre-2025-05-01' | 'post-2025-05-01';
  naplexPassDate?: Date;
  mpjeMode: 'state-specific' | 'uniform';
  mpjeState?: string;
  mpjePassDate?: Date;
  caqhId?: string;
  caqhLastAttestation?: Date;
  caqhReattestIntervalDays: number; // 120 default, 180 for IL
  pecosId?: string;
  pecosEnrollmentType?: 'provider' | 'dmepos';
  pecosLastRevalidation?: Date;
  pecosRevalidationIntervalDays: number; // 1825 (5y) or 1095 (3y)
  createdAt: Date;
  updatedAt: Date;
}

export interface PharmacistStatus {
  naplexStatus: 'valid' | 'expired' | 'not_set';
  mpjeStatus: 'valid' | 'expired' | 'not_set';
  caqhStatus: 'current' | 'due_soon' | 'overdue' | 'not_set';
  caqhDaysUntilDue?: number;
  pecosStatus: 'current' | 'due_soon' | 'overdue' | 'not_set';
  pecosDaysUntilDue?: number;
  nextActionRequired?: string;
}

export class PharmacistService {
  /**
   * Create or update pharmacist credential record
   */
  async upsertCredential(
    data: Partial<PharmacistCredential>
  ): Promise<PharmacistCredential> {
    // TODO: Implement database upsert
    // Apply defaults:
    // - caqhReattestIntervalDays = 120 (or 180 if state === 'IL')
    // - pecosRevalidationIntervalDays = 1825 (provider) or 1095 (dmepos)
    throw new Error('Not implemented');
  }

  /**
   * Compute current status and next-due dates
   */
  async computeStatus(credentialId: string): Promise<PharmacistStatus> {
    // TODO: Fetch credential from DB
    const credential = await this.getCredential(credentialId);
    if (!credential) {
      throw new Error('Credential not found');
    }

    const status: PharmacistStatus = {
      naplexStatus: this.getNaplexStatus(credential),
      mpjeStatus: this.getMpjeStatus(credential),
      caqhStatus: 'not_set',
      pecosStatus: 'not_set',
    };

    // CAQH re-attestation status
    if (credential.caqhLastAttestation) {
      const daysSinceAttest = this.daysSince(credential.caqhLastAttestation);
      const daysUntilDue =
        credential.caqhReattestIntervalDays - daysSinceAttest;
      status.caqhDaysUntilDue = daysUntilDue;

      if (daysUntilDue < 0) {
        status.caqhStatus = 'overdue';
      } else if (daysUntilDue <= 30) {
        status.caqhStatus = 'due_soon';
      } else {
        status.caqhStatus = 'current';
      }
    }

    // PECOS revalidation status
    if (credential.pecosLastRevalidation) {
      const daysSinceReval = this.daysSince(credential.pecosLastRevalidation);
      const daysUntilDue =
        credential.pecosRevalidationIntervalDays - daysSinceReval;
      status.pecosDaysUntilDue = daysUntilDue;

      if (daysUntilDue < 0) {
        status.pecosStatus = 'overdue';
      } else if (daysUntilDue <= 90) {
        status.pecosStatus = 'due_soon';
      } else {
        status.pecosStatus = 'current';
      }
    }

    // Determine next action
    status.nextActionRequired = this.getNextAction(status);

    return status;
  }

  /**
   * Get NAPLEX status
   */
  private getNaplexStatus(
    credential: PharmacistCredential
  ): 'valid' | 'expired' | 'not_set' {
    if (!credential.naplexPassDate) return 'not_set';
    // NAPLEX doesn't expire, but version matters
    return 'valid';
  }

  /**
   * Get MPJE status
   */
  private getMpjeStatus(
    credential: PharmacistCredential
  ): 'valid' | 'expired' | 'not_set' {
    if (!credential.mpjePassDate) return 'not_set';
    // MPJE typically valid for 1 year for transfer; state-dependent
    const daysSincePass = this.daysSince(credential.mpjePassDate);
    return daysSincePass <= 365 ? 'valid' : 'expired';
  }

  /**
   * Determine next required action
   */
  private getNextAction(status: PharmacistStatus): string | undefined {
    if (status.pecosStatus === 'overdue') return 'PECOS revalidation overdue';
    if (status.caqhStatus === 'overdue') return 'CAQH re-attestation overdue';
    if (status.pecosStatus === 'due_soon')
      return `PECOS revalidation due in ${status.pecosDaysUntilDue} days`;
    if (status.caqhStatus === 'due_soon')
      return `CAQH re-attestation due in ${status.caqhDaysUntilDue} days`;
    return undefined;
  }

  /**
   * Helper: days since a given date
   */
  private daysSince(date: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Fetch credential by ID
   */
  private async getCredential(
    id: string
  ): Promise<PharmacistCredential | null> {
    // TODO: Database query
    return null;
  }
}

export const pharmacistService = new PharmacistService();

