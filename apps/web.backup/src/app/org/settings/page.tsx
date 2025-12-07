'use client';

/**
 * B141B-FE-008: Security & Governance summary card in org settings home
 *
 * Displays a summary dashboard showing:
 * - Whether organizational policies have been accepted
 * - 2FA (Two-Factor Authentication) enablement status
 * - Roles configuration status
 * - Links to detailed screens for each area
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  Users,
  FileText,
  Key,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Download,
  Settings,
  ArrowRight,
} from 'lucide-react';
import { PolicyBanner } from '@/components/governance/PolicyBanner';

interface SecurityStatus {
  policiesAccepted: boolean;
  lastPolicyAcceptedAt?: string;
  pendingPolicyVersion?: string;
  twoFactorEnabled: boolean;
  twoFactorEnrollmentRate: number; // Percentage of members with 2FA enabled
  rolesConfigured: boolean;
  totalRoles: number;
  customRoles: number;
  totalMembers: number;
  membersWithRoles: number;
  recentAuditEvents: number;
  lastAuditExport?: string;
}

export default function OrgSettingsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSecurityStatus();
  }, []);

  async function fetchSecurityStatus() {
    try {
      setLoading(true);
      // TODO: Replace with actual API endpoint
      const response = await fetch('/api/org/security/status');
      if (!response.ok) throw new Error('Failed to fetch security status');

      const data = await response.json();
      setStatus(data.status);
    } catch (error) {
      console.error('Error fetching security status:', error);
      // Use mock data
      setStatus(getMockStatus());
    } finally {
      setLoading(false);
    }
  }

  function getMockStatus(): SecurityStatus {
    return {
      policiesAccepted: false,
      pendingPolicyVersion: '2.1.0',
      twoFactorEnabled: true,
      twoFactorEnrollmentRate: 68,
      rolesConfigured: true,
      totalRoles: 6,
      customRoles: 0,
      totalMembers: 45,
      membersWithRoles: 42,
      recentAuditEvents: 1247,
      lastAuditExport: '2025-11-01',
    };
  }

  function getStatusIcon(status: boolean | undefined) {
    if (status === undefined) return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    return status ? (
      <CheckCircle2 className="h-5 w-5 text-green-500" />
    ) : (
      <XCircle className="h-5 w-5 text-red-500" />
    );
  }

  function getStatusBadge(status: boolean | undefined, labels: { true: string; false: string; undefined?: string }) {
    if (status === undefined) {
      return <Badge variant="secondary">{labels.undefined || 'Unknown'}</Badge>;
    }
    return status ? (
      <Badge variant="default" className="bg-green-600">
        {labels.true}
      </Badge>
    ) : (
      <Badge variant="destructive">{labels.false}</Badge>
    );
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  if (loading || !status) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading security status...</p>
        </div>
      </div>
    );
  }

  const overallHealthScore = [
    status.policiesAccepted ? 25 : 0,
    status.twoFactorEnabled ? 25 : 0,
    status.rolesConfigured ? 25 : 0,
    (status.membersWithRoles / status.totalMembers) * 25,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Policy Banner - shows if there's a pending policy */}
      <PolicyBanner userRoles={['OrgAdmin']} orgId="org-001" />

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-8 w-8" />
          Organization Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage security, governance, and access control for your organization
        </p>
      </div>

      {/* Overall Health Score */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security & Governance Health
          </CardTitle>
          <CardDescription>
            Overall compliance and security posture
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-muted"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(overallHealthScore / 100) * 251.2} 251.2`}
                  className={
                    overallHealthScore >= 75
                      ? 'text-green-500'
                      : overallHealthScore >= 50
                      ? 'text-yellow-500'
                      : 'text-red-500'
                  }
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">{Math.round(overallHealthScore)}%</span>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-lg font-medium">
                {overallHealthScore >= 75
                  ? 'Excellent Security Posture'
                  : overallHealthScore >= 50
                  ? 'Good - Some Improvements Needed'
                  : 'Action Required - Multiple Issues Detected'}
              </p>
              <p className="text-sm text-muted-foreground">
                Your organization's security and governance configuration is {Math.round(overallHealthScore)}% complete.
                {overallHealthScore < 100 && ' Review the items below to improve your security score.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security & Governance Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Policy Acceptance */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                <CardTitle>Policy Acceptance</CardTitle>
              </div>
              {getStatusIcon(status.policiesAccepted)}
            </div>
            <CardDescription>
              Organizational policies and compliance documents
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              {getStatusBadge(status.policiesAccepted, {
                true: 'Up to Date',
                false: 'Action Required',
              })}
            </div>
            {!status.policiesAccepted && status.pendingPolicyVersion && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg">
                <p className="text-sm text-yellow-900 dark:text-yellow-100">
                  Policy version {status.pendingPolicyVersion} requires your acceptance
                </p>
              </div>
            )}
            {status.lastPolicyAcceptedAt && (
              <div className="text-sm text-muted-foreground">
                Last accepted: {formatDate(status.lastPolicyAcceptedAt)}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => router.push('/org/policies')}
            >
              View Policies
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Two-Factor Authentication */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                <CardTitle>Two-Factor Authentication</CardTitle>
              </div>
              {getStatusIcon(status.twoFactorEnabled)}
            </div>
            <CardDescription>
              Additional security layer for member accounts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Organization Setting</span>
              {getStatusBadge(status.twoFactorEnabled, {
                true: 'Enabled',
                false: 'Disabled',
              })}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Member Enrollment</span>
                <span className="font-medium">{status.twoFactorEnrollmentRate}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    status.twoFactorEnrollmentRate >= 75
                      ? 'bg-green-500'
                      : status.twoFactorEnrollmentRate >= 50
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${status.twoFactorEnrollmentRate}%` }}
                />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => router.push('/org/settings/security')}
            >
              Configure 2FA
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Roles & Permissions */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <CardTitle>Roles & Permissions</CardTitle>
              </div>
              {getStatusIcon(status.rolesConfigured)}
            </div>
            <CardDescription>
              Access control and permission management
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Roles</p>
                <p className="text-2xl font-bold">{status.totalRoles}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Custom Roles</p>
                <p className="text-2xl font-bold">{status.customRoles}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Configuration Status</span>
              {getStatusBadge(status.rolesConfigured, {
                true: 'Configured',
                false: 'Not Configured',
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => router.push('/org/settings/roles')}
            >
              Manage Roles
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Member Management */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <CardTitle>Member Management</CardTitle>
              </div>
              {getStatusIcon(status.membersWithRoles === status.totalMembers)}
            </div>
            <CardDescription>
              Organization members and role assignments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Members</p>
                <p className="text-2xl font-bold">{status.totalMembers}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">With Roles</p>
                <p className="text-2xl font-bold">{status.membersWithRoles}</p>
              </div>
            </div>
            {status.membersWithRoles < status.totalMembers && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg">
                <p className="text-sm text-yellow-900 dark:text-yellow-100">
                  {status.totalMembers - status.membersWithRoles} member(s) without assigned roles
                </p>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => router.push('/org/settings/members')}
            >
              Manage Members
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Audit & Compliance Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Audit & Compliance
          </CardTitle>
          <CardDescription>
            Monitor access logs and export audit events for compliance reporting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Recent Events (30 days)</p>
              <p className="text-2xl font-bold">{status.recentAuditEvents.toLocaleString()}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Last Export</p>
              <p className="text-sm font-medium">
                {status.lastAuditExport ? formatDate(status.lastAuditExport) : 'Never'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/org/audit/accessLogs')}
                className="flex-1"
              >
                <Eye className="mr-2 h-4 w-4" />
                View Logs
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/org/audit/export')}
                className="flex-1"
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Help & Resources */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Shield className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Security Best Practices</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Review and accept all organizational policies promptly</li>
                <li>Require 2FA for all members with elevated permissions</li>
                <li>Conduct quarterly access reviews to ensure proper role assignments</li>
                <li>Export audit logs regularly for compliance and security monitoring</li>
                <li>Assign the principle of least privilege when granting permissions</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

