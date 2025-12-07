'use client';

/**
 * B141B-FE-002: Org Role detail & edit screen (permissions checklist)
 *
 * Displays selected permissions for a role.
 * Admins can toggle allowed permissions with checkboxes.
 * Shows confirm dialog on save to prevent accidental changes.
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Save, Shield, AlertTriangle, Users } from 'lucide-react';
import { PermissionHelpTooltip } from '@/components/governance/PermissionHelpTooltip';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface Role {
  id: string;
  name: string;
  description: string;
  isSystemRole: boolean;
  membersCount: number;
  permissions: string[]; // Permission IDs
}

export default function RoleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const roleId = params?.roleId as string;

  const [role, setRole] = useState<Role | null>(null);
  const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [initialPermissions, setInitialPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (roleId) {
      fetchRoleDetails();
      fetchAvailablePermissions();
    }
  }, [roleId]);

  useEffect(() => {
    // Check if there are unsaved changes
    const changed = !areSetsEqual(selectedPermissions, initialPermissions);
    setHasChanges(changed);
  }, [selectedPermissions, initialPermissions]);

  function areSetsEqual(set1: Set<string>, set2: Set<string>): boolean {
    if (set1.size !== set2.size) return false;
    for (const item of set1) {
      if (!set2.has(item)) return false;
    }
    return true;
  }

  async function fetchRoleDetails() {
    try {
      setLoading(true);
      // TODO: Replace with actual API endpoint
      const response = await fetch(`/api/org/roles/${roleId}`);
      if (!response.ok) throw new Error('Failed to fetch role details');

      const data = await response.json();
      setRole(data.role);
      const permSet = new Set(data.role.permissions);
      setSelectedPermissions(permSet);
      setInitialPermissions(new Set(permSet));
    } catch (error) {
      console.error('Error fetching role details:', error);
      // Use mock data
      const mockRole = getMockRole();
      setRole(mockRole);
      const permSet = new Set(mockRole.permissions);
      setSelectedPermissions(permSet);
      setInitialPermissions(new Set(permSet));
    } finally {
      setLoading(false);
    }
  }

  async function fetchAvailablePermissions() {
    try {
      // TODO: Replace with actual API endpoint
      const response = await fetch('/api/org/permissions');
      if (!response.ok) throw new Error('Failed to fetch permissions');

      const data = await response.json();
      setAvailablePermissions(data.permissions || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      // Use mock data
      setAvailablePermissions(getMockPermissions());
    }
  }

  function getMockRole(): Role {
    return {
      id: roleId,
      name: roleId === '1' ? 'OrgAdmin' : 'PrivilegeReviewer',
      description: roleId === '1'
        ? 'Full administrative access to organization settings'
        : 'Can review and approve privilege requests',
      isSystemRole: true,
      membersCount: roleId === '1' ? 3 : 12,
      permissions: roleId === '1'
        ? ['perm1', 'perm2', 'perm3', 'perm4', 'perm5', 'perm6']
        : ['perm7', 'perm8', 'perm9'],
    };
  }

  function getMockPermissions(): Permission[] {
    return [
      { id: 'perm1', name: 'org.members.read', description: 'View organization members', category: 'Organization', riskLevel: 'low' },
      { id: 'perm2', name: 'org.members.write', description: 'Add or remove organization members', category: 'Organization', riskLevel: 'high' },
      { id: 'perm3', name: 'org.roles.read', description: 'View roles and permissions', category: 'Organization', riskLevel: 'low' },
      { id: 'perm4', name: 'org.roles.write', description: 'Modify roles and assign permissions', category: 'Organization', riskLevel: 'critical' },
      { id: 'perm5', name: 'org.settings.read', description: 'View organization settings', category: 'Organization', riskLevel: 'low' },
      { id: 'perm6', name: 'org.settings.write', description: 'Modify organization settings', category: 'Organization', riskLevel: 'critical' },
      { id: 'perm7', name: 'privileges.review', description: 'Review privilege requests', category: 'Privileging', riskLevel: 'high' },
      { id: 'perm8', name: 'privileges.approve', description: 'Approve or deny privilege requests', category: 'Privileging', riskLevel: 'high' },
      { id: 'perm9', name: 'credentials.view', description: 'View provider credentials', category: 'Credentials', riskLevel: 'medium' },
      { id: 'perm10', name: 'audit.read', description: 'View audit logs', category: 'Audit', riskLevel: 'medium' },
      { id: 'perm11', name: 'audit.export', description: 'Export audit logs', category: 'Audit', riskLevel: 'medium' },
      { id: 'perm12', name: 'payer.enroll', description: 'Submit payer enrollment applications', category: 'Payer', riskLevel: 'high' },
    ];
  }

  function togglePermission(permissionId: string) {
    const newSelected = new Set(selectedPermissions);
    if (newSelected.has(permissionId)) {
      newSelected.delete(permissionId);
    } else {
      newSelected.add(permissionId);
    }
    setSelectedPermissions(newSelected);
  }

  function handleSaveClick() {
    if (!hasChanges) return;
    setShowConfirmDialog(true);
  }

  async function handleConfirmSave() {
    try {
      setSaving(true);
      // TODO: Replace with actual API endpoint
      const response = await fetch(`/api/org/roles/${roleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permissions: Array.from(selectedPermissions),
        }),
      });

      if (!response.ok) throw new Error('Failed to save role permissions');

      // Update initial permissions to match current
      setInitialPermissions(new Set(selectedPermissions));
      setShowConfirmDialog(false);

      // Show success message (you could add a toast notification here)
      alert('Role permissions updated successfully');
    } catch (error) {
      console.error('Error saving role permissions:', error);
      alert('Failed to save role permissions. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function getRiskBadgeVariant(riskLevel: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (riskLevel) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'outline';
    }
  }

  // Group permissions by category
  const permissionsByCategory = availablePermissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (loading || !role) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading role details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/org/settings/roles')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Roles
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            {role.name}
          </h1>
          <p className="text-muted-foreground mt-2">{role.description}</p>
          <div className="flex items-center gap-3 mt-3">
            {role.isSystemRole && (
              <Badge variant="secondary">System Role</Badge>
            )}
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{role.membersCount} members</span>
            </div>
          </div>
        </div>
        <Button
          onClick={handleSaveClick}
          disabled={!hasChanges || saving}
          size="default"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Warning for system roles */}
      {role.isSystemRole && (
        <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                  System Role
                </p>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  This is a system-defined role. Modifying its permissions may affect {role.membersCount} member{role.membersCount !== 1 ? 's' : ''}.
                  Changes will take effect immediately.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Permissions by Category */}
      {Object.keys(permissionsByCategory).sort().map((category) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle>{category} Permissions</CardTitle>
            <CardDescription>
              {permissionsByCategory[category].length} permission{permissionsByCategory[category].length !== 1 ? 's' : ''} available
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {permissionsByCategory[category].map((permission) => (
                <div
                  key={permission.id}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    id={`perm-${permission.id}`}
                    checked={selectedPermissions.has(permission.id)}
                    onCheckedChange={() => togglePermission(permission.id)}
                    aria-label={`Toggle ${permission.name}`}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor={`perm-${permission.id}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {permission.name}
                      </label>
                      <Badge variant={getRiskBadgeVariant(permission.riskLevel)} className="text-xs">
                        {permission.riskLevel}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {permission.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Summary</CardTitle>
          <CardDescription>
            Overview of selected permissions for this role
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Selected</p>
              <p className="text-2xl font-bold">{selectedPermissions.size}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Available</p>
              <p className="text-2xl font-bold">{availablePermissions.length}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Assigned Members</p>
              <p className="text-2xl font-bold">{role.membersCount}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Changes</p>
              <p className="text-2xl font-bold">{hasChanges ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Permission Changes</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to save these permission changes? This will affect {role.membersCount} member{role.membersCount !== 1 ? 's' : ''} with the "{role.name}" role.
              Changes will take effect immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSave} disabled={saving}>
              {saving ? 'Saving...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

