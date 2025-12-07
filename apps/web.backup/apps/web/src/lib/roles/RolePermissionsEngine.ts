/**
 * Role Permissions Engine
 * Phase 3: Role-Based Permissions & Scope
 *
 * Connects the Multi-Role Identity Engine to scope-of-practice + privileges.
 */

import { RoleType, RolePrivileges, roleEngine } from './RoleEngine';

/**
 * Permission Action
 * Defines what actions can be performed
 */
export type PermissionAction =
  | 'view_credentials'
  | 'view_chain'
  | 'view_compliance'
  | 'view_skills'
  | 'share_profile'
  | 'verify_credential'
  | 'request_credential'
  | 'revoke_credential'
  | 'evaluate_resident'
  | 'supervise_mentee'
  | 'submit_grant'
  | 'track_irb'
  | 'manage_team'
  | 'view_analytics'
  | 'manage_privileges'
  | 'schedule_shift'
  | 'view_shifts'
  | 'track_ceu'
  | 'check_telemedicine_eligibility'
  | 'view_regions';

/**
 * Scope of Role
 * Defines allowed procedures, educational tasks, and supervision tasks
 */
export interface ScopeOfRole {
  roleType: RoleType;
  allowedProcedures: string[];
  allowedEducationalTasks: string[];
  allowedSupervisionTasks: string[];
  privilegingPathways: PrivilegingPathway[];
}

/**
 * Privileging Pathway
 * Defines pathways for role-specific privileging
 */
export interface PrivilegingPathway {
  id: string;
  name: string;
  roleType: RoleType;
  requirements: string[];
  privileges: string[];
  status: 'available' | 'in_progress' | 'completed' | 'locked';
}

/**
 * Role Permissions Matrix
 * Defines permissions for each role
 */
const rolePermissionsMatrix: Record<RoleType, RolePrivileges> = {
  [RoleType.CLINICIAN]: {
    allowedActions: [
      'view_credentials',
      'view_chain',
      'view_compliance',
      'view_skills',
      'share_profile',
      'verify_credential',
      'request_credential',
      'view_analytics',
      'manage_privileges',
    ],
    restrictedTasks: ['revoke_credential', 'evaluate_resident', 'manage_team'],
    visibilityPermissions: {
      canViewCredentials: true,
      canViewChain: true,
      canViewCompliance: true,
      canViewSkills: true,
    },
    scopeOfPractice: {
      allowedProcedures: ['patient_care', 'diagnosis', 'treatment', 'prescription'],
      allowedEducationalTasks: ['continuing_education', 'certification_renewal'],
      allowedSupervisionTasks: [],
    },
  },
  [RoleType.NURSE]: {
    allowedActions: [
      'view_credentials',
      'view_chain',
      'view_compliance',
      'view_skills',
      'share_profile',
      'verify_credential',
      'view_shifts',
      'track_ceu',
    ],
    restrictedTasks: [
      'revoke_credential',
      'evaluate_resident',
      'manage_team',
      'manage_privileges',
    ],
    visibilityPermissions: {
      canViewCredentials: true,
      canViewChain: true,
      canViewCompliance: true,
      canViewSkills: true,
    },
    scopeOfPractice: {
      allowedProcedures: ['patient_care', 'medication_administration', 'assessment'],
      allowedEducationalTasks: ['ceu_tracking', 'certification_renewal'],
      allowedSupervisionTasks: ['nursing_student_supervision'],
    },
  },
  [RoleType.FACULTY]: {
    allowedActions: [
      'view_credentials',
      'view_chain',
      'view_compliance',
      'view_skills',
      'share_profile',
      'verify_credential',
      'evaluate_resident',
      'view_analytics',
    ],
    restrictedTasks: ['revoke_credential', 'manage_team', 'manage_privileges'],
    visibilityPermissions: {
      canViewCredentials: true,
      canViewChain: true,
      canViewCompliance: true,
      canViewSkills: true,
    },
    scopeOfPractice: {
      allowedProcedures: ['patient_care', 'teaching', 'evaluation'],
      allowedEducationalTasks: [
        'curriculum_design',
        'resident_evaluation',
        'teaching_portfolio',
      ],
      allowedSupervisionTasks: ['resident_supervision', 'student_supervision'],
    },
  },
  [RoleType.RESEARCHER]: {
    allowedActions: [
      'view_credentials',
      'view_chain',
      'view_compliance',
      'view_skills',
      'share_profile',
      'verify_credential',
      'submit_grant',
      'track_irb',
      'view_analytics',
    ],
    restrictedTasks: [
      'revoke_credential',
      'evaluate_resident',
      'manage_team',
      'manage_privileges',
    ],
    visibilityPermissions: {
      canViewCredentials: true,
      canViewChain: true,
      canViewCompliance: true,
      canViewSkills: true,
    },
    scopeOfPractice: {
      allowedProcedures: ['research_procedures', 'data_collection', 'analysis'],
      allowedEducationalTasks: ['research_training', 'grant_writing'],
      allowedSupervisionTasks: ['research_assistant_supervision'],
    },
  },
  [RoleType.ADMINISTRATOR]: {
    allowedActions: [
      'view_credentials',
      'view_chain',
      'view_compliance',
      'view_skills',
      'share_profile',
      'verify_credential',
      'manage_team',
      'view_analytics',
      'manage_privileges',
    ],
    restrictedTasks: ['revoke_credential', 'evaluate_resident'],
    visibilityPermissions: {
      canViewCredentials: true,
      canViewChain: true,
      canViewCompliance: true,
      canViewSkills: true,
    },
    scopeOfPractice: {
      allowedProcedures: ['administrative_tasks', 'policy_management'],
      allowedEducationalTasks: ['compliance_training', 'leadership_development'],
      allowedSupervisionTasks: ['staff_supervision', 'department_management'],
    },
  },
  [RoleType.PRECEPTOR]: {
    allowedActions: [
      'view_credentials',
      'view_chain',
      'view_compliance',
      'view_skills',
      'share_profile',
      'verify_credential',
      'supervise_mentee',
      'evaluate_resident',
    ],
    restrictedTasks: ['revoke_credential', 'manage_team', 'manage_privileges'],
    visibilityPermissions: {
      canViewCredentials: true,
      canViewChain: true,
      canViewCompliance: true,
      canViewSkills: true,
    },
    scopeOfPractice: {
      allowedProcedures: ['patient_care', 'teaching', 'supervision'],
      allowedEducationalTasks: [
        'mentee_evaluation',
        'clinical_teaching',
        'competency_assessment',
      ],
      allowedSupervisionTasks: [
        'resident_supervision',
        'student_supervision',
        'mentee_supervision',
      ],
    },
  },
  [RoleType.TELEMEDICINE]: {
    allowedActions: [
      'view_credentials',
      'view_chain',
      'view_compliance',
      'view_skills',
      'share_profile',
      'verify_credential',
      'check_telemedicine_eligibility',
      'view_regions',
    ],
    restrictedTasks: [
      'revoke_credential',
      'evaluate_resident',
      'manage_team',
      'manage_privileges',
    ],
    visibilityPermissions: {
      canViewCredentials: true,
      canViewChain: true,
      canViewCompliance: true,
      canViewSkills: true,
    },
    scopeOfPractice: {
      allowedProcedures: ['telemedicine_consultation', 'remote_diagnosis'],
      allowedEducationalTasks: ['telemedicine_training', 'technology_certification'],
      allowedSupervisionTasks: [],
    },
  },
  [RoleType.MULTI_FACILITY]: {
    allowedActions: [
      'view_credentials',
      'view_chain',
      'view_compliance',
      'view_skills',
      'share_profile',
      'verify_credential',
      'manage_privileges',
      'view_analytics',
    ],
    restrictedTasks: ['revoke_credential', 'evaluate_resident', 'manage_team'],
    visibilityPermissions: {
      canViewCredentials: true,
      canViewChain: true,
      canViewCompliance: true,
      canViewSkills: true,
    },
    scopeOfPractice: {
      allowedProcedures: ['patient_care', 'cross_facility_care'],
      allowedEducationalTasks: ['multi_facility_training', 'credentialing_renewal'],
      allowedSupervisionTasks: [],
    },
  },
};

/**
 * Privileging Pathways
 */
const privilegingPathways: PrivilegingPathway[] = [
  {
    id: 'faculty_residency_evaluator',
    name: 'Residency Program Evaluator',
    roleType: RoleType.FACULTY,
    requirements: [
      'faculty_appointment',
      'teaching_certificate',
      'board_certification',
    ],
    privileges: ['evaluate_resident', 'supervise_resident', 'approve_rotations'],
    status: 'available',
  },
  {
    id: 'clinician_privilege_request',
    name: 'Clinical Privileges',
    roleType: RoleType.CLINICIAN,
    requirements: [
      'medical_license',
      'board_certification',
      'hospital_privileges',
    ],
    privileges: ['perform_procedures', 'admit_patients', 'order_tests'],
    status: 'available',
  },
  {
    id: 'telemedicine_multi_state',
    name: 'Multi-State Telemedicine Provider',
    roleType: RoleType.TELEMEDICINE,
    requirements: [
      'medical_license',
      'telemedicine_license',
      'state_telemedicine_registration',
    ],
    privileges: [
      'practice_telemedicine',
      'prescribe_remotely',
      'consult_across_states',
    ],
    status: 'available',
  },
];

/**
 * RolePermissionsEngine
 * Manages role-based permissions and scope of practice
 */
export class RolePermissionsEngine {
  /**
   * Get permissions for a role
   */
  getRolePermissions(roleType: RoleType): RolePrivileges {
    return rolePermissionsMatrix[roleType] || rolePermissionsMatrix[RoleType.CLINICIAN];
  }

  /**
   * Check if an action is allowed for a role
   */
  canPerformAction(roleType: RoleType, action: PermissionAction): boolean {
    const permissions = this.getRolePermissions(roleType);
    return permissions.allowedActions.includes(action);
  }

  /**
   * Check if a task is restricted for a role
   */
  isTaskRestricted(roleType: RoleType, task: string): boolean {
    const permissions = this.getRolePermissions(roleType);
    return permissions.restrictedTasks.includes(task);
  }

  /**
   * Get scope of role
   */
  getScopeOfRole(roleType: RoleType): ScopeOfRole {
    const permissions = this.getRolePermissions(roleType);
    const pathways = privilegingPathways.filter((p) => p.roleType === roleType);

    return {
      roleType,
      allowedProcedures: permissions.scopeOfPractice.allowedProcedures,
      allowedEducationalTasks: permissions.scopeOfPractice.allowedEducationalTasks,
      allowedSupervisionTasks: permissions.scopeOfPractice.allowedSupervisionTasks,
      privilegingPathways: pathways,
    };
  }

  /**
   * Get privileging pathways for a role
   */
  getPrivilegingPathways(roleType: RoleType): PrivilegingPathway[] {
    return privilegingPathways.filter((p) => p.roleType === roleType);
  }

  /**
   * Check if a privilege is visible for a role
   */
  isPrivilegeVisible(roleType: RoleType, privilege: string): boolean {
    const pathways = this.getPrivilegingPathways(roleType);
    return pathways.some((p) => p.privileges.includes(privilege));
  }

  /**
   * Get next steps to activate a role
   * Returns requirements that need to be met
   */
  getNextStepsToActivateRole(
    did: string,
    roleType: RoleType
  ): {
    requirements: string[];
    blockers: string[];
    canActivate: boolean;
  } {
    const { canActivate, blockers, nextSteps } = roleEngine.canActivateRole(did, roleType);

    return {
      requirements: nextSteps,
      blockers,
      canActivate,
    };
  }

  /**
   * Get role compliance score
   * Calculates compliance based on role requirements
   */
  getRoleComplianceScore(roleType: RoleType, credentials: any[]): number {
    const profile = roleEngine.getRoleProfile('', roleType); // This would need actual DID
    if (!profile) {
      return 0;
    }

    return roleEngine.recalculateComplianceScore(profile);
  }

  /**
   * Adjust risk score when switching roles
   * Different roles have different risk profiles
   */
  adjustRiskScoreForRole(
    currentRole: RoleType | null,
    newRole: RoleType,
    baseRiskScore: number
  ): number {
    // Risk multipliers by role
    const riskMultipliers: Record<RoleType, number> = {
      [RoleType.CLINICIAN]: 1.0,
      [RoleType.NURSE]: 0.9,
      [RoleType.FACULTY]: 0.8,
      [RoleType.RESEARCHER]: 0.7,
      [RoleType.ADMINISTRATOR]: 0.6,
      [RoleType.PRECEPTOR]: 0.9,
      [RoleType.TELEMEDICINE]: 1.1, // Higher risk due to remote care
      [RoleType.MULTI_FACILITY]: 1.2, // Higher risk due to complexity
    };

    const multiplier = riskMultipliers[newRole] || 1.0;
    let adjustedScore = baseRiskScore * multiplier;

    // If switching from a lower-risk role to higher-risk, add transition penalty
    if (currentRole) {
      const currentMultiplier = riskMultipliers[currentRole] || 1.0;
      if (multiplier > currentMultiplier) {
        adjustedScore *= 1.1; // 10% penalty for increasing risk
      }
    }

    return Math.min(1.0, adjustedScore);
  }

  /**
   * Create chain-anchored role activation event
   * This would integrate with the chain service to anchor role switches
   */
  async createRoleActivationEvent(
    did: string,
    roleType: RoleType,
    metadata?: Record<string, unknown>
  ): Promise<string | null> {
    // This would call the chain service to anchor the role activation
    // For now, return a mock transaction hash
    const event = {
      type: 'role_activation',
      did,
      roleType,
      timestamp: new Date().toISOString(),
      metadata,
    };

    // In a real implementation, this would:
    // 1. Create a chain event
    // 2. Sign it with the DID
    // 3. Anchor it to the blockchain
    // 4. Return the transaction hash

    console.log('Role activation event:', event);
    return `0x${Math.random().toString(16).substring(2, 66)}`;
  }
}

// Singleton instance
export const rolePermissionsEngine = new RolePermissionsEngine();

