'use client';

/**
 * B141B-FE-003: Org member management table (users + roles)
 *
 * Displays a table showing:
 * - Member name, email, and assigned roles
 * - Supports adding/removing roles via modal
 * - Search functionality to filter members by name or email
 * - Accessible design with proper ARIA labels
 */

import { useState, useEffect } from 'react';
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
import { Search, Users, UserPlus, Edit } from 'lucide-react';
import { AssignRolesModal } from '@/components/governance/AssignRolesModal';

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
  joinedAt: string;
  lastActive: string;
}

export default function OrgMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  useEffect(() => {
    fetchMembers();
    fetchAvailableRoles();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredMembers(members);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredMembers(
        members.filter(
          (member) =>
            member.name.toLowerCase().includes(query) ||
            member.email.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, members]);

  async function fetchMembers() {
    try {
      setLoading(true);
      // TODO: Replace with actual API endpoint
      const response = await fetch('/api/org/members');
      if (!response.ok) throw new Error('Failed to fetch members');

      const data = await response.json();
      setMembers(data.members || []);
      setFilteredMembers(data.members || []);
    } catch (error) {
      console.error('Error fetching members:', error);
      // Use mock data
      const mockMembers = getMockMembers();
      setMembers(mockMembers);
      setFilteredMembers(mockMembers);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAvailableRoles() {
    try {
      // TODO: Replace with actual API endpoint
      const response = await fetch('/api/org/roles');
      if (!response.ok) throw new Error('Failed to fetch roles');

      const data = await response.json();
      setAvailableRoles(data.roles || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
      // Use mock data
      setAvailableRoles(getMockRoles());
    }
  }

  function getMockMembers(): Member[] {
    return [
      {
        id: '1',
        name: 'Alice Johnson',
        email: 'alice.johnson@example.com',
        currentRoles: ['1', '5'], // OrgAdmin, AuditViewer
        joinedAt: '2024-01-15',
        lastActive: '2025-11-12',
      },
      {
        id: '2',
        name: 'Bob Smith',
        email: 'bob.smith@example.com',
        currentRoles: ['2'], // PrivilegeReviewer
        joinedAt: '2024-03-20',
        lastActive: '2025-11-13',
      },
      {
        id: '3',
        name: 'Carol Martinez',
        email: 'carol.martinez@example.com',
        currentRoles: ['3', '4'], // PayerAdmin, CredentialVerifier
        joinedAt: '2024-05-10',
        lastActive: '2025-11-11',
      },
      {
        id: '4',
        name: 'David Lee',
        email: 'david.lee@example.com',
        currentRoles: ['4', '5'], // CredentialVerifier, AuditViewer
        joinedAt: '2024-07-01',
        lastActive: '2025-11-13',
      },
      {
        id: '5',
        name: 'Emma Wilson',
        email: 'emma.wilson@example.com',
        currentRoles: ['6'], // MemberViewer
        joinedAt: '2024-09-15',
        lastActive: '2025-11-10',
      },
    ];
  }

  function getMockRoles(): Role[] {
    return [
      {
        id: '1',
        name: 'OrgAdmin',
        description: 'Full administrative access to organization settings',
        permissionsCount: 15,
        riskLevel: 'critical',
      },
      {
        id: '2',
        name: 'PrivilegeReviewer',
        description: 'Can review and approve privilege requests',
        permissionsCount: 8,
        riskLevel: 'high',
      },
      {
        id: '3',
        name: 'PayerAdmin',
        description: 'Full administrative access to payer enrollment',
        permissionsCount: 12,
        riskLevel: 'critical',
      },
      {
        id: '4',
        name: 'CredentialVerifier',
        description: 'Can verify provider credentials',
        permissionsCount: 6,
        riskLevel: 'medium',
      },
      {
        id: '5',
        name: 'AuditViewer',
        description: 'Read-only access to audit logs',
        permissionsCount: 4,
        riskLevel: 'medium',
      },
      {
        id: '6',
        name: 'MemberViewer',
        description: 'Read-only access to view members',
        permissionsCount: 2,
        riskLevel: 'low',
      },
    ];
  }

  function getRoleNameById(roleId: string): string {
    const role = availableRoles.find(r => r.id === roleId);
    return role ? role.name : 'Unknown';
  }

  function handleAssignRoles(member: Member) {
    setSelectedMember(member);
    setShowAssignModal(true);
  }

  async function handleSaveRoles(memberId: string, roleIds: string[]) {
    try {
      // TODO: Replace with actual API endpoint
      const response = await fetch(`/api/org/members/${memberId}/roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleIds }),
      });

      if (!response.ok) throw new Error('Failed to update member roles');

      // Update local state
      setMembers(members.map(member =>
        member.id === memberId
          ? { ...member, currentRoles: roleIds }
          : member
      ));

      // Show success message (you could add a toast notification here)
      alert('Member roles updated successfully');
    } catch (error) {
      console.error('Error updating member roles:', error);
      throw error; // Re-throw to let modal handle the error
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Organization Members
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage member roles and access permissions
          </p>
        </div>
        <Button onClick={() => {/* TODO: Add new member */}} size="default">
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </div>

      {/* Search and Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Search Members</CardTitle>
              <CardDescription>
                Find members by name or email address
              </CardDescription>
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">{members.length}</span> total members
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              aria-label="Search members"
            />
          </div>
        </CardContent>
      </Card>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>Member List</CardTitle>
          <CardDescription>
            {filteredMembers.length} {filteredMembers.length === 1 ? 'member' : 'members'} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading members...
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No members found matching your search criteria
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.name}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {member.email}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {member.currentRoles.length === 0 ? (
                          <Badge variant="outline">No roles</Badge>
                        ) : (
                          member.currentRoles.map((roleId) => (
                            <Badge key={roleId} variant="secondary">
                              {getRoleNameById(roleId)}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {formatDate(member.joinedAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(member.lastActive)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAssignRoles(member)}
                        aria-label={`Manage roles for ${member.name}`}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Manage Roles
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
            <Users className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Managing Members & Roles</p>
              <p>
                Use the "Manage Roles" button to assign or remove roles from organization members.
                Role changes take effect immediately and will update the member's access permissions.
              </p>
              <p>
                Members can have multiple roles. Their effective permissions will be the union of all
                permissions granted by their assigned roles.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assign Roles Modal */}
      <AssignRolesModal
        open={showAssignModal}
        onOpenChange={setShowAssignModal}
        member={selectedMember}
        availableRoles={availableRoles}
        onSave={handleSaveRoles}
      />
    </div>
  );
}

