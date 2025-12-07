/**
 * Credential Filter Engine
 * Phase 2: Role-Based Credential Filtering
 *
 * Each role sees only the credentials relevant to that identity.
 */

import { RoleType, roleEngine } from './RoleEngine';

/**
 * Credential Type
 * Represents a credential in the system
 */
export interface Credential {
  id: string;
  type: string;
  issuer: string;
  subject: string;
  status: 'active' | 'revoked' | 'expired';
  issuedDate: string;
  expiresDate?: string;
  txHash?: string;
  network?: string;
  metadata?: Record<string, unknown>;
  evidence?: string[];
}

/**
 * Credential Type Mapping
 * Maps credential types to relevant roles
 */
const credentialRoleMapping: Record<string, RoleType[]> = {
  // Clinician credentials
  'medical_license': [RoleType.CLINICIAN, RoleType.TELEMEDICINE, RoleType.MULTI_FACILITY],
  'dea_registration': [RoleType.CLINICIAN, RoleType.TELEMEDICINE],
  'board_certification': [RoleType.CLINICIAN, RoleType.FACULTY, RoleType.PRECEPTOR],
  'hospital_privileges': [RoleType.CLINICIAN, RoleType.MULTI_FACILITY],
  'malpractice_insurance': [RoleType.CLINICIAN, RoleType.NURSE, RoleType.TELEMEDICINE],

  // Nurse credentials
  'rn_license': [RoleType.NURSE],
  'aprn_license': [RoleType.NURSE],
  'nlc_compact': [RoleType.NURSE, RoleType.MULTI_FACILITY],
  'ceu_completion': [RoleType.NURSE],
  'nursing_certification': [RoleType.NURSE],

  // Faculty credentials
  'faculty_appointment': [RoleType.FACULTY],
  'teaching_certificate': [RoleType.FACULTY, RoleType.PRECEPTOR],
  'training_portfolio': [RoleType.FACULTY],
  'publication': [RoleType.FACULTY, RoleType.RESEARCHER],
  'academic_degree': [RoleType.FACULTY, RoleType.RESEARCHER],

  // Researcher credentials
  'irb_approval': [RoleType.RESEARCHER],
  'grant_award': [RoleType.RESEARCHER],
  'research_certification': [RoleType.RESEARCHER],
  'clinical_trial_certification': [RoleType.RESEARCHER],

  // Administrator credentials
  'leadership_certification': [RoleType.ADMINISTRATOR],
  'compliance_training': [RoleType.ADMINISTRATOR, RoleType.CLINICIAN, RoleType.NURSE],
  'management_certificate': [RoleType.ADMINISTRATOR],

  // Preceptor credentials
  'preceptor_certification': [RoleType.PRECEPTOR],
  'supervision_authorization': [RoleType.PRECEPTOR, RoleType.FACULTY],

  // Telemedicine credentials
  'telemedicine_license': [RoleType.TELEMEDICINE],
  'state_telemedicine_registration': [RoleType.TELEMEDICINE, RoleType.MULTI_FACILITY],

  // Multi-facility credentials
  'multi_state_license': [RoleType.MULTI_FACILITY],
  'facility_credentialing': [RoleType.MULTI_FACILITY, RoleType.CLINICIAN],
};

/**
 * CredentialFilterEngine
 * Filters credentials based on role visibility rules
 */
export class CredentialFilterEngine {
  /**
   * Filter credentials for a specific role
   */
  filterCredentialsByRole(
    credentials: Credential[],
    roleType: RoleType
  ): Credential[] {
    return credentials.filter((cred) => this.isCredentialVisibleForRole(cred, roleType));
  }

  /**
   * Check if a credential is visible for a role
   */
  isCredentialVisibleForRole(credential: Credential, roleType: RoleType): boolean {
    // Get roles that can see this credential type
    const allowedRoles = credentialRoleMapping[credential.type] || [];

    // If no mapping exists, show to all roles (fallback)
    if (allowedRoles.length === 0) {
      return true;
    }

    return allowedRoles.includes(roleType);
  }

  /**
   * Get role-specific credential types
   */
  getCredentialTypesForRole(roleType: RoleType): string[] {
    const types: string[] = [];

    for (const [credType, roles] of Object.entries(credentialRoleMapping)) {
      if (roles.includes(roleType)) {
        types.push(credType);
      }
    }

    return types;
  }

  /**
   * Get selective disclosure defaults per role
   * Different roles may want to disclose different attributes
   */
  getSelectiveDisclosureDefaults(roleType: RoleType): Record<string, boolean> {
    const defaults: Record<RoleType, Record<string, boolean>> = {
      [RoleType.CLINICIAN]: {
        licenseNumber: true,
        specialty: true,
        boardCertification: true,
        npi: true,
        dea: true,
        publications: false,
        grants: false,
      },
      [RoleType.NURSE]: {
        licenseNumber: true,
        nlc: true,
        ceu: true,
        certifications: true,
        publications: false,
        grants: false,
      },
      [RoleType.FACULTY]: {
        licenseNumber: true,
        specialty: true,
        publications: true,
        teachingExperience: true,
        boardCertification: true,
        grants: false,
      },
      [RoleType.RESEARCHER]: {
        licenseNumber: true,
        publications: true,
        grants: true,
        irbApprovals: true,
        boardCertification: true,
      },
      [RoleType.ADMINISTRATOR]: {
        licenseNumber: true,
        leadershipCerts: true,
        complianceTraining: true,
        publications: false,
        grants: false,
      },
      [RoleType.PRECEPTOR]: {
        licenseNumber: true,
        specialty: true,
        preceptorCert: true,
        teachingExperience: true,
        boardCertification: true,
      },
      [RoleType.TELEMEDICINE]: {
        licenseNumber: true,
        telemedicineLicenses: true,
        stateRegistrations: true,
        boardCertification: true,
        publications: false,
      },
      [RoleType.MULTI_FACILITY]: {
        licenseNumber: true,
        multiStateLicenses: true,
        facilityCredentialing: true,
        boardCertification: true,
        publications: false,
      },
    };

    return defaults[roleType] || {};
  }

  /**
   * Calculate role-specific trust score
   * Different roles weight trust factors differently
   */
  calculateRoleTrustScore(
    credential: Credential,
    roleType: RoleType,
    baseTrustScore: number
  ): number {
    // Get role profile to access role-specific trust calculation
    // This would typically come from the RoleEngine
    const roleWeights = this.getRoleTrustWeights(roleType);

    // Adjust trust score based on role-specific factors
    let adjustedScore = baseTrustScore;

    // Boost for role-relevant credentials
    if (this.isCredentialVisibleForRole(credential, roleType)) {
      adjustedScore *= 1.1; // 10% boost for relevant credentials
    }

    // Penalize for missing role-critical credentials
    const criticalTypes = this.getCriticalCredentialTypes(roleType);
    if (criticalTypes.includes(credential.type)) {
      // Critical credentials get higher weight
      adjustedScore *= 1.15;
    }

    return Math.min(1.0, adjustedScore);
  }

  /**
   * Get role-specific trust weights
   */
  private getRoleTrustWeights(roleType: RoleType): Record<string, number> {
    // This would integrate with RoleEngine's trust calculation
    // For now, return default weights
    return {
      issuer: 0.4,
      evidence: 0.3,
      anchor: 0.2,
      temporal: 0.1,
    };
  }

  /**
   * Get critical credential types for a role
   */
  private getCriticalCredentialTypes(roleType: RoleType): string[] {
    const critical: Record<RoleType, string[]> = {
      [RoleType.CLINICIAN]: ['medical_license', 'board_certification', 'dea_registration'],
      [RoleType.NURSE]: ['rn_license', 'nlc_compact'],
      [RoleType.FACULTY]: ['faculty_appointment', 'teaching_certificate'],
      [RoleType.RESEARCHER]: ['irb_approval', 'research_certification'],
      [RoleType.ADMINISTRATOR]: ['leadership_certification', 'compliance_training'],
      [RoleType.PRECEPTOR]: ['preceptor_certification', 'supervision_authorization'],
      [RoleType.TELEMEDICINE]: ['telemedicine_license', 'medical_license'],
      [RoleType.MULTI_FACILITY]: ['multi_state_license', 'facility_credentialing'],
    };

    return critical[roleType] || [];
  }

  /**
   * Get role-specific credential gaps
   * Identifies missing credentials that are important for a role
   */
  getCredentialGapsForRole(
    roleType: RoleType,
    existingCredentials: Credential[]
  ): string[] {
    const criticalTypes = this.getCriticalCredentialTypes(roleType);
    const existingTypes = existingCredentials.map((c) => c.type);

    return criticalTypes.filter((type) => !existingTypes.includes(type));
  }

  /**
   * Get compliance alerts specific to role requirements
   */
  getRoleComplianceAlerts(
    roleType: RoleType,
    credentials: Credential[]
  ): Array<{ severity: 'critical' | 'warning' | 'info'; message: string }> {
    const alerts: Array<{ severity: 'critical' | 'warning' | 'info'; message: string }> = [];

    // Check for missing critical credentials
    const gaps = this.getCredentialGapsForRole(roleType, credentials);
    if (gaps.length > 0) {
      alerts.push({
        severity: 'critical',
        message: `Missing critical credentials: ${gaps.join(', ')}`,
      });
    }

    // Check for expired credentials
    const expired = credentials.filter(
      (c) => c.status === 'expired' && this.isCredentialVisibleForRole(c, roleType)
    );
    if (expired.length > 0) {
      alerts.push({
        severity: 'warning',
        message: `${expired.length} role-relevant credential(s) expired`,
      });
    }

    // Check for expiring soon (within 30 days)
    const now = new Date();
    const expiringSoon = credentials.filter((c) => {
      if (!c.expiresDate || c.status !== 'active') return false;
      const expires = new Date(c.expiresDate);
      const daysUntilExpiry = (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return daysUntilExpiry > 0 && daysUntilExpiry <= 30 && this.isCredentialVisibleForRole(c, roleType);
    });

    if (expiringSoon.length > 0) {
      alerts.push({
        severity: 'info',
        message: `${expiringSoon.length} credential(s) expiring within 30 days`,
      });
    }

    return alerts;
  }

  /**
   * Get role-based profile summary
   * Returns a summary of credentials relevant to the role
   */
  getRoleProfileSummary(
    roleType: RoleType,
    credentials: Credential[]
  ): {
    totalCredentials: number;
    activeCredentials: number;
    expiredCredentials: number;
    expiringSoon: number;
    criticalCredentials: number;
    trustScore: number;
  } {
    const roleCredentials = this.filterCredentialsByRole(credentials, roleType);
    const active = roleCredentials.filter((c) => c.status === 'active');
    const expired = roleCredentials.filter((c) => c.status === 'expired');

    const now = new Date();
    const expiringSoon = roleCredentials.filter((c) => {
      if (!c.expiresDate || c.status !== 'active') return false;
      const expires = new Date(c.expiresDate);
      const daysUntilExpiry = (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
    });

    const criticalTypes = this.getCriticalCredentialTypes(roleType);
    const criticalCredentials = roleCredentials.filter((c) =>
      criticalTypes.includes(c.type) && c.status === 'active'
    ).length;

    // Calculate average trust score (simplified)
    const trustScore =
      roleCredentials.length > 0
        ? roleCredentials.reduce((sum, c) => sum + 0.8, 0) / roleCredentials.length
        : 0;

    return {
      totalCredentials: roleCredentials.length,
      activeCredentials: active.length,
      expiredCredentials: expired.length,
      expiringSoon: expiringSoon.length,
      criticalCredentials,
      trustScore,
    };
  }
}

// Singleton instance
export const credentialFilterEngine = new CredentialFilterEngine();

