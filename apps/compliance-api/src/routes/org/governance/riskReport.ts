/**
 * Governance Risk Report: Identify security and compliance risks
 *
 * Flags high-risk conditions:
 * - Admin accounts without 2FA
 * - Organizations without policy acceptance
 * - Permission drift and over-privileged accounts
 * - Inactive admin accounts
 * - Unusual access patterns
 *
 * @module compliance-api/routes/org/governance/riskReport
 */

import type { Request, Response } from 'express';

// ============================================================================
// Types
// ============================================================================

export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';
export type RiskCategory =
  | 'authentication'
  | 'authorization'
  | 'policy_compliance'
  | 'account_hygiene'
  | 'access_pattern'
  | 'permission_drift';

export interface RiskItem {
  riskId: string;
  severity: RiskSeverity;
  category: RiskCategory;
  title: string;
  description: string;
  affectedEntity: {
    type: 'user' | 'organization' | 'integration';
    id: string;
    name: string;
  };
  details: Record<string, any>;
  remediationSteps: string[];
  remediationPriority: number;
  detectedAt: string;
  status: 'open' | 'acknowledged' | 'remediated' | 'accepted';
}

export interface RiskReportSummary {
  orgId: string;
  orgName: string;
  generatedAt: string;
  generatedBy: string;
  overallRiskScore: number; // 0-100
  riskCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  categoryBreakdown: Record<RiskCategory, number>;
  topRisks: RiskItem[];
  allRisks: RiskItem[];
  recommendations: string[];
}

export interface RiskReportQuery {
  severity?: RiskSeverity[];
  category?: RiskCategory[];
  status?: ('open' | 'acknowledged' | 'remediated' | 'accepted')[];
  includeRemediated?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const SEVERITY_SCORES: Record<RiskSeverity, number> = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
};

// ============================================================================
// Main Handler
// ============================================================================

/**
 * GET /compliance/org/:orgId/governance/risk-report
 *
 * Generates governance risk report identifying security and compliance issues.
 *
 * Query Parameters:
 * - severity: comma-separated list (critical,high,medium,low)
 * - category: comma-separated list of risk categories
 * - status: comma-separated list (open,acknowledged,remediated,accepted)
 * - includeRemediated: boolean (default: false)
 *
 * Response: RiskReportSummary with all identified risks
 */
export async function getRiskReport(req: Request, res: Response): Promise<void> {
  try {
    const { orgId } = req.params;
    const query: RiskReportQuery = {
      severity: req.query.severity
        ? (req.query.severity as string).split(',') as RiskSeverity[]
        : undefined,
      category: req.query.category
        ? (req.query.category as string).split(',') as RiskCategory[]
        : undefined,
      status: req.query.status
        ? (req.query.status as string).split(',') as ('open' | 'acknowledged' | 'remediated' | 'accepted')[]
        : undefined,
      includeRemediated: req.query.includeRemediated === 'true',
    };

    // Get current user for audit
    const currentUser = (req as any).user;
    if (!currentUser) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Verify user has permission to view risk reports
    if (!hasRiskReportPermission(currentUser)) {
      res.status(403).json({ error: 'Insufficient permissions to view risk reports' });
      return;
    }

    // Generate risk report
    const report = await generateRiskReport(orgId, query, currentUser);

    res.json(report);

    // Audit log
    await logRiskReportGeneration(orgId, currentUser.userId, query);
  } catch (error) {
    console.error('Error generating risk report:', error);
    res.status(500).json({ error: 'Failed to generate risk report' });
  }
}

// ============================================================================
// Risk Detection & Report Generation
// ============================================================================

async function generateRiskReport(
  orgId: string,
  query: RiskReportQuery,
  currentUser: any
): Promise<RiskReportSummary> {
  // Detect all risks
  const allRisks = await detectAllRisks(orgId);

  // Apply filters
  let filteredRisks = allRisks;

  if (!query.includeRemediated) {
    filteredRisks = filteredRisks.filter(r => r.status !== 'remediated');
  }

  if (query.severity && query.severity.length > 0) {
    filteredRisks = filteredRisks.filter(r => query.severity!.includes(r.severity));
  }

  if (query.category && query.category.length > 0) {
    filteredRisks = filteredRisks.filter(r => query.category!.includes(r.category));
  }

  if (query.status && query.status.length > 0) {
    filteredRisks = filteredRisks.filter(r => query.status!.includes(r.status));
  }

  // Calculate risk counts
  const riskCounts = {
    critical: filteredRisks.filter(r => r.severity === 'critical').length,
    high: filteredRisks.filter(r => r.severity === 'high').length,
    medium: filteredRisks.filter(r => r.severity === 'medium').length,
    low: filteredRisks.filter(r => r.severity === 'low').length,
    total: filteredRisks.length,
  };

  // Category breakdown
  const categoryBreakdown: Record<RiskCategory, number> = {
    authentication: 0,
    authorization: 0,
    policy_compliance: 0,
    account_hygiene: 0,
    access_pattern: 0,
    permission_drift: 0,
  };

  filteredRisks.forEach(risk => {
    categoryBreakdown[risk.category]++;
  });

  // Calculate overall risk score (weighted average)
  const overallRiskScore = calculateOverallRiskScore(filteredRisks);

  // Top risks (sort by severity and priority)
  const topRisks = [...filteredRisks]
    .sort((a, b) => {
      const severityDiff = SEVERITY_SCORES[b.severity] - SEVERITY_SCORES[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.remediationPriority - a.remediationPriority;
    })
    .slice(0, 10);

  // Generate recommendations
  const recommendations = generateRecommendations(filteredRisks);

  return {
    orgId,
    orgName: await getOrgName(orgId),
    generatedAt: new Date().toISOString(),
    generatedBy: currentUser.email,
    overallRiskScore,
    riskCounts,
    categoryBreakdown,
    topRisks,
    allRisks: filteredRisks,
    recommendations,
  };
}

// ============================================================================
// Risk Detection Functions
// ============================================================================

async function detectAllRisks(orgId: string): Promise<RiskItem[]> {
  const risks: RiskItem[] = [];

  // Detect admins without 2FA
  risks.push(...await detectAdminsWithout2FA(orgId));

  // Detect organizations without policy acceptance
  risks.push(...await detectMissingPolicyAcceptance(orgId));

  // Detect permission drift
  risks.push(...await detectPermissionDrift(orgId));

  // Detect inactive admin accounts
  risks.push(...await detectInactiveAdmins(orgId));

  // Detect unusual access patterns
  risks.push(...await detectUnusualAccessPatterns(orgId));

  // Detect over-privileged accounts
  risks.push(...await detectOverPrivilegedAccounts(orgId));

  return risks;
}

async function detectAdminsWithout2FA(orgId: string): Promise<RiskItem[]> {
  // Mock implementation - replace with actual database query
  const adminsWithout2FA = [
    {
      userId: 'user_admin_002',
      email: 'admin2@hospital.org',
      name: 'Bob Admin',
      role: 'organization_admin',
    },
  ];

  return adminsWithout2FA.map(user => ({
    riskId: `risk_2fa_${user.userId}`,
    severity: 'high' as RiskSeverity,
    category: 'authentication' as RiskCategory,
    title: 'Admin Account Without Two-Factor Authentication',
    description: `Admin user ${user.name} (${user.email}) does not have 2FA enabled, creating a security risk for privileged account compromise.`,
    affectedEntity: {
      type: 'user' as const,
      id: user.userId,
      name: user.name,
    },
    details: {
      email: user.email,
      role: user.role,
      twoFactorEnabled: false,
      recommendation: 'Require 2FA for all admin accounts',
    },
    remediationSteps: [
      'Navigate to User Management → Search for user',
      'Click "Require 2FA" option',
      'User will be prompted to set up 2FA on next login',
      'Verify 2FA is configured before granting admin access',
    ],
    remediationPriority: 90,
    detectedAt: new Date().toISOString(),
    status: 'open',
  }));
}

async function detectMissingPolicyAcceptance(orgId: string): Promise<RiskItem[]> {
  // Mock implementation
  const usersWithoutPolicyAcceptance = [
    {
      userId: 'user_cred_003',
      email: 'credentialing@hospital.org',
      name: 'Sarah Credentialing',
      role: 'credentialing_manager',
      missingPolicies: ['Privacy Policy v2.0', 'Acceptable Use Policy v1.5'],
    },
  ];

  return usersWithoutPolicyAcceptance.map(user => ({
    riskId: `risk_policy_${user.userId}`,
    severity: 'medium' as RiskSeverity,
    category: 'policy_compliance' as RiskCategory,
    title: 'User Has Not Accepted Required Policies',
    description: `User ${user.name} (${user.email}) has not accepted ${user.missingPolicies.length} required organizational policies.`,
    affectedEntity: {
      type: 'user' as const,
      id: user.userId,
      name: user.name,
    },
    details: {
      email: user.email,
      role: user.role,
      missingPolicies: user.missingPolicies,
    },
    remediationSteps: [
      'Send policy acceptance reminder to user',
      'Set deadline for acceptance (e.g., 7 days)',
      'Lock account if policies not accepted by deadline',
      'Review with manager if user repeatedly delays acceptance',
    ],
    remediationPriority: 60,
    detectedAt: new Date().toISOString(),
    status: 'open',
  }));
}

async function detectPermissionDrift(orgId: string): Promise<RiskItem[]> {
  // Mock implementation - detect users with more permissions than their role baseline
  const driftedUsers = [
    {
      userId: 'user_std_004',
      email: 'user@hospital.org',
      name: 'Tom User',
      role: 'standard_user',
      excessPermissions: ['audit.read', 'report.generate'],
      grantedAt: '2025-06-15T10:00:00Z',
      grantedBy: 'user_admin_001',
    },
  ];

  return driftedUsers.map(user => ({
    riskId: `risk_drift_${user.userId}`,
    severity: 'medium' as RiskSeverity,
    category: 'permission_drift' as RiskCategory,
    title: 'Permission Drift Detected',
    description: `User ${user.name} has ${user.excessPermissions.length} permissions beyond their role baseline.`,
    affectedEntity: {
      type: 'user' as const,
      id: user.userId,
      name: user.name,
    },
    details: {
      email: user.email,
      role: user.role,
      excessPermissions: user.excessPermissions,
      grantedAt: user.grantedAt,
      grantedBy: user.grantedBy,
    },
    remediationSteps: [
      'Review business justification for extra permissions',
      'Confirm with user\'s manager if still needed',
      'If temporary, set expiration date on permissions',
      'If no longer needed, revoke excess permissions',
      'Consider creating a custom role if common pattern',
    ],
    remediationPriority: 50,
    detectedAt: new Date().toISOString(),
    status: 'open',
  }));
}

async function detectInactiveAdmins(orgId: string): Promise<RiskItem[]> {
  // Mock implementation - detect admin accounts with no recent activity
  const inactiveAdmins = [
    {
      userId: 'user_admin_003',
      email: 'oldadmin@hospital.org',
      name: 'Alice Former-Admin',
      role: 'organization_admin',
      lastLogin: '2024-08-15T10:00:00Z',
      daysSinceLogin: 90,
    },
  ];

  return inactiveAdmins.map(user => ({
    riskId: `risk_inactive_${user.userId}`,
    severity: 'high' as RiskSeverity,
    category: 'account_hygiene' as RiskCategory,
    title: 'Inactive Admin Account',
    description: `Admin account ${user.name} (${user.email}) has been inactive for ${user.daysSinceLogin} days.`,
    affectedEntity: {
      type: 'user' as const,
      id: user.userId,
      name: user.name,
    },
    details: {
      email: user.email,
      role: user.role,
      lastLogin: user.lastLogin,
      daysSinceLogin: user.daysSinceLogin,
    },
    remediationSteps: [
      'Verify employment status with HR',
      'If user left organization, immediately revoke all access',
      'If on extended leave, reduce privileges to standard user',
      'If returning soon, require password reset and 2FA verification',
      'Document decision and review monthly',
    ],
    remediationPriority: 85,
    detectedAt: new Date().toISOString(),
    status: 'open',
  }));
}

async function detectUnusualAccessPatterns(orgId: string): Promise<RiskItem[]> {
  // Mock implementation - detect anomalous access patterns
  const unusualPatterns: RiskItem[] = [];

  // Example: User accessing at unusual times
  unusualPatterns.push({
    riskId: `risk_access_pattern_001`,
    severity: 'low' as RiskSeverity,
    category: 'access_pattern' as RiskCategory,
    title: 'Unusual Access Time Detected',
    description: 'User accessed system during unusual hours (3am-5am local time) on multiple occasions.',
    affectedEntity: {
      type: 'user' as const,
      id: 'user_cred_003',
      name: 'Sarah Credentialing',
    },
    details: {
      unusualAccessTimes: ['2025-11-10T03:15:00Z', '2025-11-11T04:30:00Z'],
      normalAccessPattern: 'Weekdays 8am-6pm',
      deviation: 'Off-hours access',
    },
    remediationSteps: [
      'Contact user to verify activity was legitimate',
      'Review actions performed during unusual times',
      'If legitimate, document reason (e.g., on-call, emergency)',
      'If suspicious, follow suspicious access runbook',
      'Consider setting up alerts for future off-hours access',
    ],
    remediationPriority: 40,
    detectedAt: new Date().toISOString(),
    status: 'open',
  });

  return unusualPatterns;
}

async function detectOverPrivilegedAccounts(orgId: string): Promise<RiskItem[]> {
  // Mock implementation - detect accounts with admin privileges that may not need them
  const overPrivileged = [
    {
      userId: 'user_dept_admin_005',
      email: 'deptadmin@hospital.org',
      name: 'Mike Department',
      role: 'department_admin',
      suspiciousPermissions: ['user.delete', 'org.settings.update'],
      jobTitle: 'Department Coordinator',
    },
  ];

  return overPrivileged.map(user => ({
    riskId: `risk_overpriv_${user.userId}`,
    severity: 'medium' as RiskSeverity,
    category: 'authorization' as RiskCategory,
    title: 'Potentially Over-Privileged Account',
    description: `User ${user.name} has administrative permissions that may exceed job requirements.`,
    affectedEntity: {
      type: 'user' as const,
      id: user.userId,
      name: user.name,
    },
    details: {
      email: user.email,
      role: user.role,
      jobTitle: user.jobTitle,
      suspiciousPermissions: user.suspiciousPermissions,
    },
    remediationSteps: [
      'Review job description and actual duties',
      'Consult with user\'s manager on required permissions',
      'Check if user actually uses these permissions (audit logs)',
      'If not needed, revoke or downgrade role',
      'Document business justification if permissions are required',
    ],
    remediationPriority: 55,
    detectedAt: new Date().toISOString(),
    status: 'open',
  }));
}

// ============================================================================
// Risk Scoring & Recommendations
// ============================================================================

function calculateOverallRiskScore(risks: RiskItem[]): number {
  if (risks.length === 0) return 0;

  const openRisks = risks.filter(r => r.status === 'open');
  if (openRisks.length === 0) return 0;

  // Weight by severity and count
  const totalScore = openRisks.reduce((sum, risk) => {
    return sum + SEVERITY_SCORES[risk.severity];
  }, 0);

  // Average, normalized to 0-100
  const avgScore = totalScore / openRisks.length;

  // Adjust for quantity (more risks = higher overall score)
  const countMultiplier = Math.min(1 + (openRisks.length / 100), 1.5);

  return Math.min(Math.round(avgScore * countMultiplier), 100);
}

function generateRecommendations(risks: RiskItem[]): string[] {
  const recommendations: string[] = [];

  const openRisks = risks.filter(r => r.status === 'open');

  // High-priority recommendations
  const criticalCount = openRisks.filter(r => r.severity === 'critical').length;
  const highCount = openRisks.filter(r => r.severity === 'high').length;

  if (criticalCount > 0) {
    recommendations.push(
      `🚨 URGENT: Address ${criticalCount} critical risk(s) immediately. These pose immediate security threats.`
    );
  }

  if (highCount > 0) {
    recommendations.push(
      `⚠️  Prioritize ${highCount} high-severity risk(s) within 48 hours.`
    );
  }

  // Category-specific recommendations
  const authRisks = openRisks.filter(r => r.category === 'authentication').length;
  if (authRisks > 0) {
    recommendations.push(
      `🔐 Enable mandatory 2FA for all admin accounts (${authRisks} admin(s) currently without 2FA).`
    );
  }

  const policyRisks = openRisks.filter(r => r.category === 'policy_compliance').length;
  if (policyRisks > 0) {
    recommendations.push(
      `📋 Send policy acceptance reminders and set acceptance deadlines for ${policyRisks} user(s).`
    );
  }

  const hygienRisks = openRisks.filter(r => r.category === 'account_hygiene').length;
  if (hygienRisks > 0) {
    recommendations.push(
      `🧹 Review ${hygienRisks} inactive or orphaned account(s). Revoke access for former employees.`
    );
  }

  const driftRisks = openRisks.filter(r => r.category === 'permission_drift').length;
  if (driftRisks > 0) {
    recommendations.push(
      `📊 Audit and remediate permission drift for ${driftRisks} user(s). Align permissions with roles.`
    );
  }

  // General best practices
  if (openRisks.length === 0) {
    recommendations.push('✅ No open risks detected. Continue regular quarterly governance reviews.');
  } else {
    recommendations.push(
      `🔄 Schedule weekly risk review meetings until high-priority risks are remediated.`
    );
    recommendations.push(
      `📖 Reference runbooks: Suspicious Access and Role Misassignment for detailed remediation guidance.`
    );
  }

  return recommendations;
}

// ============================================================================
// Helpers
// ============================================================================

async function getOrgName(orgId: string): Promise<string> {
  // Mock implementation
  return 'Sample Hospital System';
}

function hasRiskReportPermission(user: any): boolean {
  const allowedRoles = [
    'organization_admin',
    'compliance_officer',
    'auditor',
  ];
  return allowedRoles.includes(user.role);
}

async function logRiskReportGeneration(
  orgId: string,
  userId: string,
  query: RiskReportQuery
): Promise<void> {
  // Mock implementation - replace with actual audit log service
  console.log('[AUDIT]', {
    action: 'governance.risk_report.generate',
    actor: userId,
    resource: { type: 'organization', id: orgId },
    details: {
      filters: query,
    },
    timestamp: new Date().toISOString(),
  });
}

// ============================================================================
// Export
// ============================================================================

export default getRiskReport;

