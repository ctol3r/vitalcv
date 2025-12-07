'use client';

/**
 * B141B-FE-009: Tooltips explaining major permissions
 *
 * Provides accessible tooltips that explain the scope and risk of various permissions.
 * Keyboard and screen reader accessible. Content matches documentation.
 */

import { Info, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface PermissionInfo {
  name: string;
  description: string;
  scope: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  examples?: string[];
}

const PERMISSION_DEFINITIONS: Record<string, PermissionInfo> = {
  'PrivilegeReviewer': {
    name: 'Privilege Reviewer',
    description: 'Can review and approve privilege requests for healthcare providers.',
    scope: 'Read and approve privileging applications, view provider credentials',
    riskLevel: 'high',
    examples: ['Review privilege applications', 'Approve/deny requests', 'View credential documents'],
  },
  'PayerAdmin': {
    name: 'Payer Administrator',
    description: 'Full administrative access to payer enrollment and credentialing processes.',
    scope: 'Manage payer enrollments, configure verification settings, access PHI',
    riskLevel: 'critical',
    examples: ['Manage payer contracts', 'Configure verification rules', 'Access provider PHI'],
  },
  'OrgAdmin': {
    name: 'Organization Administrator',
    description: 'Full administrative access to organization settings and member management.',
    scope: 'Manage org settings, assign roles, configure policies, access audit logs',
    riskLevel: 'critical',
    examples: ['Add/remove members', 'Assign roles', 'Configure org policies', 'View audit logs'],
  },
  'AuditViewer': {
    name: 'Audit Viewer',
    description: 'Can view audit logs and access logs for compliance and security monitoring.',
    scope: 'Read-only access to audit events, access logs, and security reports',
    riskLevel: 'medium',
    examples: ['View audit logs', 'Export audit reports', 'Monitor access patterns'],
  },
  'CredentialVerifier': {
    name: 'Credential Verifier',
    description: 'Can verify provider credentials against primary sources.',
    scope: 'Verify licenses, certifications, and education credentials',
    riskLevel: 'medium',
    examples: ['Verify licenses', 'Check board certifications', 'Validate education'],
  },
  'CompactCoordinator': {
    name: 'Compact Coordinator',
    description: 'Manages interstate compact privileges and licensure.',
    scope: 'Process compact applications, verify multi-state licenses',
    riskLevel: 'high',
    examples: ['Process NLC applications', 'Verify compact eligibility', 'Manage multi-state privileges'],
  },
  'PolicyManager': {
    name: 'Policy Manager',
    description: 'Can create, update, and publish organizational policies.',
    scope: 'Manage policy documents, publish policy versions, track acceptance',
    riskLevel: 'high',
    examples: ['Create policies', 'Publish updates', 'Track policy acceptance'],
  },
  'MemberViewer': {
    name: 'Member Viewer',
    description: 'Read-only access to view organization members and their roles.',
    scope: 'View member list, see assigned roles (cannot modify)',
    riskLevel: 'low',
    examples: ['View member directory', 'See role assignments', 'Export member list'],
  },
};

interface PermissionHelpTooltipProps {
  permissionKey: string;
  showIcon?: boolean;
  iconSize?: number;
}

export function PermissionHelpTooltip({
  permissionKey,
  showIcon = true,
  iconSize = 16
}: PermissionHelpTooltipProps) {
  const permissionInfo = PERMISSION_DEFINITIONS[permissionKey];

  if (!permissionInfo) {
    return null;
  }

  const riskColors = {
    low: 'text-green-600 dark:text-green-400',
    medium: 'text-yellow-600 dark:text-yellow-400',
    high: 'text-orange-600 dark:text-orange-400',
    critical: 'text-red-600 dark:text-red-400',
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-sm opacity-70 hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label={`Learn more about ${permissionInfo.name}`}
        >
          {showIcon && <HelpCircle size={iconSize} className="text-muted-foreground" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-sm p-4" sideOffset={8}>
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm mb-1">{permissionInfo.name}</h4>
            <p className="text-xs opacity-90">{permissionInfo.description}</p>
          </div>

          <div>
            <p className="text-xs font-medium mb-1">Scope:</p>
            <p className="text-xs opacity-90">{permissionInfo.scope}</p>
          </div>

          {permissionInfo.examples && permissionInfo.examples.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1">Examples:</p>
              <ul className="text-xs opacity-90 space-y-1 list-disc list-inside">
                {permissionInfo.examples.map((example, idx) => (
                  <li key={idx}>{example}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-2 border-t border-primary-foreground/20">
            <div className="flex items-center gap-2">
              <Info size={12} className={riskColors[permissionInfo.riskLevel]} />
              <p className={`text-xs font-medium ${riskColors[permissionInfo.riskLevel]}`}>
                Risk Level: {permissionInfo.riskLevel.toUpperCase()}
              </p>
            </div>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export { PERMISSION_DEFINITIONS };

