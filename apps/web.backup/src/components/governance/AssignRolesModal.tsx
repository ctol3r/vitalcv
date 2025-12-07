'use client';

/**
 * B141B-FE-004: Assign roles modal for org members
 *
 * Provides a modal dialog for assigning/removing roles from organization members.
 * Features:
 * - Multi-select checkboxes for roles
 * - Shows permission summary for selected roles
 * - ESC key closes the modal
 * - Full screen reader support with ARIA labels
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Users, AlertTriangle } from 'lucide-react';

interface Role {
  id: string;
  name: string;
  description: string;
  permissionsCount: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface Member {
  id: string;
  name: string;
  email: string;
  currentRoles: string[]; // Role IDs
}

interface AssignRolesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Member | null;
  availableRoles: Role[];
  onSave: (memberId: string, roleIds: string[]) => Promise<void>;
}

export function AssignRolesModal({
  open,
  onOpenChange,
  member,
  availableRoles,
  onSave,
}: AssignRolesModalProps) {
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Initialize selected roles when member changes
  useEffect(() => {
    if (member) {
      setSelectedRoles(new Set(member.currentRoles));
    } else {
      setSelectedRoles(new Set());
    }
  }, [member]);

  // Handle ESC key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        handleClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  function toggleRole(roleId: string) {
    const newSelected = new Set(selectedRoles);
    if (newSelected.has(roleId)) {
      newSelected.delete(roleId);
    } else {
      newSelected.add(roleId);
    }
    setSelectedRoles(newSelected);
  }

  function handleClose() {
    if (!saving) {
      onOpenChange(false);
    }
  }

  async function handleSave() {
    if (!member) return;

    try {
      setSaving(true);
      await onSave(member.id, Array.from(selectedRoles));
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving role assignments:', error);
      // Error should be handled by parent component
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

  // Calculate permission summary
  const selectedRoleObjects = availableRoles.filter(role => selectedRoles.has(role.id));
  const totalPermissions = selectedRoleObjects.reduce((sum, role) => sum + role.permissionsCount, 0);
  const highestRiskLevel = selectedRoleObjects.reduce((highest, role) => {
    const levels = ['low', 'medium', 'high', 'critical'];
    const currentLevel = levels.indexOf(role.riskLevel);
    const highestLevel = levels.indexOf(highest);
    return currentLevel > highestLevel ? role.riskLevel : highest;
  }, 'low' as 'low' | 'medium' | 'high' | 'critical');

  const hasChanges = member
    ? !areSetsEqual(selectedRoles, new Set(member.currentRoles))
    : false;

  function areSetsEqual(set1: Set<string>, set2: Set<string>): boolean {
    if (set1.size !== set2.size) return false;
    for (const item of set1) {
      if (!set2.has(item)) return false;
    }
    return true;
  }

  if (!member) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        aria-describedby="assign-roles-description"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Assign Roles to {member.name}
          </DialogTitle>
          <DialogDescription id="assign-roles-description">
            Select the roles you want to assign to {member.email}.
            Press ESC to close this dialog.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Available Roles */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Available Roles</h3>
            {availableRoles.map((role) => (
              <div
                key={role.id}
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  id={`role-${role.id}`}
                  checked={selectedRoles.has(role.id)}
                  onCheckedChange={() => toggleRole(role.id)}
                  aria-label={`Assign ${role.name} role`}
                  className="mt-1"
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor={`role-${role.id}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {role.name}
                    </label>
                    <Badge variant={getRiskBadgeVariant(role.riskLevel)} className="text-xs">
                      {role.riskLevel}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {role.permissionsCount} permissions
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {role.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Permission Summary */}
          {selectedRoles.size > 0 && (
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Permission Summary
                </h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Roles Selected</p>
                    <p className="text-lg font-semibold">{selectedRoles.size}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Permissions</p>
                    <p className="text-lg font-semibold">{totalPermissions}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Highest Risk</p>
                    <Badge variant={getRiskBadgeVariant(highestRiskLevel)} className="mt-1">
                      {highestRiskLevel}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Warning for high-risk roles */}
          {selectedRoleObjects.some(role => role.riskLevel === 'high' || role.riskLevel === 'critical') && (
            <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                      High-Risk Permissions
                    </p>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      You are assigning roles with elevated permissions. Please ensure this user should have these privileges.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

