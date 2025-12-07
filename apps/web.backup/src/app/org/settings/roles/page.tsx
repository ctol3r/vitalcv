'use client';

/**
 * B141B-FE-001: Org settings: Roles & Permissions page
 *
 * Displays a table of all available roles and their permissions.
 * Provides buttons to view role details.
 * Screen reader friendly with proper ARIA labels and semantic headings.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Eye, Shield, Users, Plus } from 'lucide-react';
import { PermissionHelpTooltip } from '@/components/governance/PermissionHelpTooltip';

interface Permission {
  id: string;
  name: string;
  description: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissionsCount: number;
  membersCount: number;
  permissions: Permission[];
  isSystemRole: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export default function RolesPermissionsPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [filteredRoles, setFilteredRoles] = useState<Role[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredRoles(roles);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredRoles(
        roles.filter(
          (role) =>
            role.name.toLowerCase().includes(query) ||
            role.description.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, roles]);

  async function fetchRoles() {
    try {
      setLoading(true);
      // TODO: Replace with actual API endpoint
      const response = await fetch('/api/org/roles');
      if (!response.ok) throw new Error('Failed to fetch roles');

      const data = await response.json();
      setRoles(data.roles || []);
      setFilteredRoles(data.roles || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
      // Use mock data for demo
      const mockRoles = getMockRoles();
      setRoles(mockRoles);
      setFilteredRoles(mockRoles);
    } finally {
      setLoading(false);
    }
  }

  function getMockRoles(): Role[] {
    return [
      {
        id: '1',
        name: 'OrgAdmin',
        description: 'Full administrative access to organization settings and member management',
        permissionsCount: 15,
        membersCount: 3,
        permissions: [],
        isSystemRole: true,
        riskLevel: 'critical',
      },
      {
        id: '2',
        name: 'PrivilegeReviewer',
        description: 'Can review and approve privilege requests for healthcare providers',
        permissionsCount: 8,
        membersCount: 12,
        permissions: [],
        isSystemRole: true,
        riskLevel: 'high',
      },
      {
        id: '3',
        name: 'PayerAdmin',
        description: 'Full administrative access to payer enrollment and credentialing processes',
        permissionsCount: 12,
        membersCount: 5,
        permissions: [],
        isSystemRole: true,
        riskLevel: 'critical',
      },
      {
        id: '4',
        name: 'CredentialVerifier',
        description: 'Can verify provider credentials against primary sources',
        permissionsCount: 6,
        membersCount: 8,
        permissions: [],
        isSystemRole: true,
        riskLevel: 'medium',
      },
      {
        id: '5',
        name: 'AuditViewer',
        description: 'Read-only access to audit logs and access logs',
        permissionsCount: 4,
        membersCount: 7,
        permissions: [],
        isSystemRole: true,
        riskLevel: 'medium',
      },
      {
        id: '6',
        name: 'MemberViewer',
        description: 'Read-only access to view organization members and their roles',
        permissionsCount: 2,
        membersCount: 25,
        permissions: [],
        isSystemRole: true,
        riskLevel: 'low',
      },
    ];
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

  function viewRoleDetails(roleId: string) {
    router.push(`/org/settings/roles/${roleId}`);
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Roles & Permissions
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage organization roles and their associated permissions
          </p>
        </div>
        <Button onClick={() => router.push('/org/settings/roles/new')} size="default">
          <Plus className="mr-2 h-4 w-4" />
          Create Role
        </Button>
      </div>

      {/* Search and Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Search Roles</CardTitle>
              <CardDescription>
                Find roles by name or description
              </CardDescription>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>{roles.length} roles</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>{roles.reduce((acc, role) => acc + role.membersCount, 0)} assigned</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by role name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              aria-label="Search roles"
            />
          </div>
        </CardContent>
      </Card>

      {/* Roles Table */}
      <Card>
        <CardHeader>
          <CardTitle>Available Roles</CardTitle>
          <CardDescription>
            {filteredRoles.length} {filteredRoles.length === 1 ? 'role' : 'roles'} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading roles...
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No roles found matching your search criteria
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Permissions</TableHead>
                  <TableHead className="text-center">Members</TableHead>
                  <TableHead className="text-center">Risk Level</TableHead>
                  <TableHead className="text-center">Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{role.name}</span>
                        <PermissionHelpTooltip
                          permissionKey={role.name}
                          showIcon={true}
                          iconSize={14}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <span className="text-sm text-muted-foreground">
                        {role.description}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {role.permissionsCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{role.membersCount}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={getRiskBadgeVariant(role.riskLevel)}>
                        {role.riskLevel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {role.isSystemRole ? (
                        <Badge variant="secondary">System</Badge>
                      ) : (
                        <Badge variant="outline">Custom</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewRoleDetails(role.id)}
                        aria-label={`View details for ${role.name}`}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Help Text */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Shield className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">About Roles & Permissions</p>
              <p>
                Roles define sets of permissions that control what actions members can perform in your organization.
                System roles are predefined and cannot be deleted, but you can create custom roles tailored to your needs.
              </p>
              <p>
                Hover over the help icon next to any role name to learn more about its permissions and risk level.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

