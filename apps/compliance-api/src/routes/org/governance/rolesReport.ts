/**
 * Governance Report: Role & Permission Inventory
 *
 * Provides comprehensive role and permission inventory for an organization.
 * Supports CSV and JSON export formats for compliance and audit purposes.
 *
 * @module compliance-api/routes/org/governance/rolesReport
 */

import type { Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export interface RoleInventoryEntry {
  userId: string;
  email: string;
  name: string;
  role: string;
  department?: string;
  permissions: string[];
  twoFactorEnabled: boolean;
  lastLogin?: string;
  createdAt: string;
  status: 'active' | 'inactive' | 'locked';
}

export interface RoleInventoryReport {
  orgId: string;
  orgName: string;
  generatedAt: string;
  generatedBy: string;
  totalUsers: number;
  breakdown: {
    byRole: Record<string, number>;
    byDepartment: Record<string, number>;
    with2FA: number;
    without2FA: number;
    activeUsers: number;
    inactiveUsers: number;
  };
  users: RoleInventoryEntry[];
}

export interface RolesReportQuery {
  format?: 'json' | 'csv';
  includeInactive?: boolean;
  roles?: string[];
  departments?: string[];
  with2FAOnly?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const ROLE_LABELS: Record<string, string> = {
  organization_admin: 'Organization Admin',
  compliance_officer: 'Compliance Officer',
  credentialing_manager: 'Credentialing Manager',
  privileging_coordinator: 'Privileging Coordinator',
  auditor: 'Auditor (Read-Only)',
  department_admin: 'Department Admin',
  hr_manager: 'HR Manager',
  standard_user: 'Standard User',
  clinician: 'Clinician',
  staff_member: 'Staff Member',
};

const KEY_PERMISSIONS: Record<string, string[]> = {
  organization_admin: [
    'user.create',
    'user.update',
    'user.delete',
    'user.role.update',
    'audit.export',
    'evidence.manage',
    'policy.configure',
    'integration.manage',
  ],
  compliance_officer: [
    'audit.read',
    'audit.export',
    'evidence.read',
    'evidence.export',
    'report.generate',
    'risk.view',
  ],
  credentialing_manager: [
    'credential.verify',
    'license.update',
    'compact.manage',
    'privileging.view',
    'evidence.credentialing',
  ],
  privileging_coordinator: [
    'privileges.manage',
    'oppe.update',
    'committee.documents',
    'clinical.competencies',
  ],
  auditor: [
    'audit.read',
    'report.generate',
    'dashboard.view',
  ],
  department_admin: [
    'user.view.department',
    'user.update.department',
    'report.department',
  ],
  standard_user: [
    'profile.read.own',
    'profile.update.own',
  ],
};

// ============================================================================
// Main Handler
// ============================================================================

/**
 * GET /compliance/org/:orgId/governance/roles-report
 *
 * Generates role and permission inventory report for an organization.
 *
 * Query Parameters:
 * - format: 'json' | 'csv' (default: 'json')
 * - includeInactive: boolean (default: false)
 * - roles: comma-separated role names to filter
 * - departments: comma-separated department names to filter
 * - with2FAOnly: boolean (default: false) - only users with 2FA enabled
 *
 * Response:
 * - JSON: Full RoleInventoryReport object
 * - CSV: Flattened user data with headers
 */
export async function getRolesReport(req: Request, res: Response): Promise<void> {
  try {
    const { orgId } = req.params;
    const query: RolesReportQuery = {
      format: (req.query.format as 'json' | 'csv') || 'json',
      includeInactive: req.query.includeInactive === 'true',
      roles: req.query.roles ? (req.query.roles as string).split(',') : undefined,
      departments: req.query.departments ? (req.query.departments as string).split(',') : undefined,
      with2FAOnly: req.query.with2FAOnly === 'true',
    };

    // Get current user for audit
    const currentUser = (req as any).user;
    if (!currentUser) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Verify user has permission to view governance reports
    if (!hasGovernanceReportPermission(currentUser)) {
      res.status(403).json({ error: 'Insufficient permissions to view governance reports' });
      return;
    }

    // Generate report
    const report = await generateRolesReport(orgId, query, currentUser);

    // Format response
    if (query.format === 'csv') {
      const csv = formatAsCSV(report);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="roles-report-${orgId}-${Date.now()}.csv"`);
      res.send(csv);
    } else {
      res.json(report);
    }

    // Audit log
    await logReportGeneration(orgId, 'roles_report', currentUser.userId, query);
  } catch (error) {
    console.error('Error generating roles report:', error);
    res.status(500).json({ error: 'Failed to generate roles report' });
  }
}

// ============================================================================
// Report Generation
// ============================================================================

async function generateRolesReport(
  orgId: string,
  query: RolesReportQuery,
  currentUser: any
): Promise<RoleInventoryReport> {
  // Mock implementation - replace with actual database queries
  const users = await fetchOrgUsers(orgId, query);

  const breakdown = {
    byRole: {} as Record<string, number>,
    byDepartment: {} as Record<string, number>,
    with2FA: 0,
    without2FA: 0,
    activeUsers: 0,
    inactiveUsers: 0,
  };

  users.forEach(user => {
    // Role breakdown
    breakdown.byRole[user.role] = (breakdown.byRole[user.role] || 0) + 1;

    // Department breakdown
    if (user.department) {
      breakdown.byDepartment[user.department] = (breakdown.byDepartment[user.department] || 0) + 1;
    }

    // 2FA breakdown
    if (user.twoFactorEnabled) {
      breakdown.with2FA++;
    } else {
      breakdown.without2FA++;
    }

    // Status breakdown
    if (user.status === 'active') {
      breakdown.activeUsers++;
    } else {
      breakdown.inactiveUsers++;
    }
  });

  return {
    orgId,
    orgName: await getOrgName(orgId),
    generatedAt: new Date().toISOString(),
    generatedBy: currentUser.email,
    totalUsers: users.length,
    breakdown,
    users,
  };
}

async function fetchOrgUsers(
  orgId: string,
  query: RolesReportQuery
): Promise<RoleInventoryEntry[]> {
  // Mock implementation - replace with actual Prisma queries
  // This would typically query the User table with filters

  const mockUsers: RoleInventoryEntry[] = [
    {
      userId: 'user_admin_001',
      email: 'admin@hospital.org',
      name: 'Jane Admin',
      role: 'organization_admin',
      department: 'Administration',
      permissions: KEY_PERMISSIONS.organization_admin,
      twoFactorEnabled: true,
      lastLogin: '2025-11-13T10:30:00Z',
      createdAt: '2024-01-15T08:00:00Z',
      status: 'active',
    },
    {
      userId: 'user_comp_002',
      email: 'compliance@hospital.org',
      name: 'John Compliance',
      role: 'compliance_officer',
      department: 'Compliance',
      permissions: KEY_PERMISSIONS.compliance_officer,
      twoFactorEnabled: true,
      lastLogin: '2025-11-13T09:15:00Z',
      createdAt: '2024-02-01T08:00:00Z',
      status: 'active',
    },
    {
      userId: 'user_cred_003',
      email: 'credentialing@hospital.org',
      name: 'Sarah Credentialing',
      role: 'credentialing_manager',
      department: 'Medical Staff Office',
      permissions: KEY_PERMISSIONS.credentialing_manager,
      twoFactorEnabled: false,
      lastLogin: '2025-11-12T16:45:00Z',
      createdAt: '2024-03-10T08:00:00Z',
      status: 'active',
    },
  ];

  // Apply filters
  let filtered = mockUsers;

  if (!query.includeInactive) {
    filtered = filtered.filter(u => u.status === 'active');
  }

  if (query.roles && query.roles.length > 0) {
    filtered = filtered.filter(u => query.roles!.includes(u.role));
  }

  if (query.departments && query.departments.length > 0) {
    filtered = filtered.filter(u => u.department && query.departments!.includes(u.department));
  }

  if (query.with2FAOnly) {
    filtered = filtered.filter(u => u.twoFactorEnabled);
  }

  return filtered;
}

async function getOrgName(orgId: string): Promise<string> {
  // Mock implementation - replace with actual database query
  return 'Sample Hospital System';
}

// ============================================================================
// CSV Formatting
// ============================================================================

function formatAsCSV(report: RoleInventoryReport): string {
  const headers = [
    'User ID',
    'Email',
    'Name',
    'Role',
    'Role Label',
    'Department',
    'Status',
    '2FA Enabled',
    'Last Login',
    'Created At',
    'Key Permissions',
  ];

  const rows = report.users.map(user => [
    user.userId,
    user.email,
    user.name,
    user.role,
    ROLE_LABELS[user.role] || user.role,
    user.department || '',
    user.status,
    user.twoFactorEnabled ? 'Yes' : 'No',
    user.lastLogin || 'Never',
    user.createdAt,
    user.permissions.join('; '),
  ]);

  // CSV escape function
  const escape = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const csv = [
    headers.map(escape).join(','),
    ...rows.map(row => row.map(String).map(escape).join(',')),
  ].join('\n');

  return csv;
}

// ============================================================================
// Authorization
// ============================================================================

function hasGovernanceReportPermission(user: any): boolean {
  const allowedRoles = [
    'organization_admin',
    'compliance_officer',
    'auditor',
  ];
  return allowedRoles.includes(user.role);
}

// ============================================================================
// Audit Logging
// ============================================================================

async function logReportGeneration(
  orgId: string,
  reportType: string,
  userId: string,
  query: RolesReportQuery
): Promise<void> {
  // Mock implementation - replace with actual audit log service
  console.log('[AUDIT]', {
    action: 'governance.report.generate',
    actor: userId,
    resource: { type: 'organization', id: orgId },
    details: {
      reportType,
      format: query.format,
      filters: query,
    },
    timestamp: new Date().toISOString(),
  });
}

// ============================================================================
// Export
// ============================================================================

export default getRolesReport;

